package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"gopkg.in/yaml.v3"
)

const (
	hermesEventName            = "hermes-agent:event"
	hermesInteractionEventName = "hermes-agent:interaction"

	eventAssistantInit     = 1
	eventAssistantContinue = 2
	eventAssistantDone     = 3
	eventAssistantFailed   = 4
	eventToolInit          = 5
	eventToolContinue      = 6
	eventToolDone          = 7
	eventToolFailed        = 8
	eventTurnStart         = 9
	eventTurnDone          = 10
)

func hermesLogf(format string, args ...any) {
	log.Printf("[hermes] "+format, args...)
}

type HermesAgentService struct {
	ctx context.Context

	mu          sync.Mutex
	writeMu     sync.Mutex
	config      HermesConfigureRequest
	proc        *exec.Cmd
	conn        *websocket.Conn
	baseURL     string
	wsURL       string
	token       string
	nextID      int64
	pending     map[int64]chan rpcResponse
	sessions    map[string]*HermesSession
	histories   map[string][]HermesMessageDetail
	messageSeq  map[string]int
	activeTurns map[string]*activeTurn
	restored    map[string]bool
	storeLoaded bool
}

type HermesConfigureRequest struct {
	Host        string `json:"host"`
	AccessToken string `json:"accessToken"`
	APIBaseURL  string `json:"apiBaseURL"`
	AuthToken   string `json:"authToken"`
	TokenType   string `json:"tokenType"`
	SpaceID     string `json:"spaceID"`
	Resource    string `json:"resource"`
}

type HermesProviderConfigureRequest struct {
	ModelName    string `json:"modelName"`
	BaseURL      string `json:"baseURL"`
	APIKey       string `json:"apiKey"`
	TavilyAPIKey string `json:"tavilyAPIKey"`
}

type HermesStatus struct {
	Ready   bool   `json:"ready"`
	BaseURL string `json:"baseURL"`
	Mode    string `json:"mode"`
}

type HermesProviderStoredConfig struct {
	ModelName        string `json:"modelName"`
	BaseURL          string `json:"baseURL"`
	APIKeyConfigured bool   `json:"apiKeyConfigured"`
	TavilyConfigured bool   `json:"tavilyConfigured"`
}

type HermesEnvironmentVariable struct {
	Name       string `json:"name"`
	Value      string `json:"value,omitempty"`
	Configured bool   `json:"configured"`
}

type HermesEnvironmentConfigureRequest struct {
	Variables []HermesEnvironmentVariable `json:"variables"`
}

type HermesSkillInfo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Source      string `json:"source"`
	Path        string `json:"path"`
	BuiltIn     bool   `json:"builtIn"`
}

type HermesSkillList struct {
	Skills         []HermesSkillInfo `json:"skills"`
	UserSkillsDir  string            `json:"userSkillsDir"`
	BuiltInRootDir string            `json:"builtInRootDir"`
}

type HermesSkillViewRequest struct {
	Name   string `json:"name"`
	Source string `json:"source"`
}

type HermesSkillInstallRequest struct {
	SourcePath string `json:"sourcePath"`
}

type HermesSkillDeleteRequest struct {
	Name   string `json:"name"`
	Source string `json:"source"`
	Path   string `json:"path"`
}

type HermesSkillContent struct {
	Info    HermesSkillInfo `json:"info"`
	Content string          `json:"content"`
}

type HermesInteractionRequest struct {
	RequestID      string   `json:"request_id"`
	Kind           string   `json:"kind"`
	SessionID      string   `json:"session_id"`
	Title          string   `json:"title"`
	Message        string   `json:"message"`
	Command        string   `json:"command,omitempty"`
	Description    string   `json:"description,omitempty"`
	PatternKey     string   `json:"pattern_key,omitempty"`
	PatternKeys    []string `json:"pattern_keys,omitempty"`
	AllowPermanent bool     `json:"allow_permanent,omitempty"`
	Sensitive      bool     `json:"sensitive,omitempty"`
	TimeoutSeconds int      `json:"timeout_seconds,omitempty"`
}

type HermesInteractionResolveRequest struct {
	RequestID string `json:"request_id"`
	Action    string `json:"action"`
	Value     string `json:"value,omitempty"`
}

type HermesSession struct {
	ID               string `json:"id"`
	Title            string `json:"title"`
	UserID           string `json:"user_id"`
	SpaceID          string `json:"space_id"`
	LatestAccessTime int64  `json:"latest_access_time"`
}

type HermesSessionList struct {
	List  []HermesSession `json:"list"`
	Total int             `json:"total"`
}

type HermesMessageList struct {
	List  []HermesMessageDetail `json:"list"`
	Total int                   `json:"total"`
}

type HermesMessageDetail struct {
	Meta HermesMessageMeta `json:"meta"`
	Ext  HermesMessageExt  `json:"ext"`
}

type HermesMessageMeta struct {
	MessageID   string         `json:"message_id"`
	Sequence    int            `json:"sequence"`
	SendTime    int64          `json:"send_time"`
	Role        int            `json:"role"`
	UserID      string         `json:"user_id"`
	SessionID   string         `json:"session_id"`
	Complete    int            `json:"complete"`
	MessageType int            `json:"message_type"`
	Message     map[string]any `json:"message"`
	Attach      []any          `json:"attach"`
}

type HermesMessageExt struct {
	IsRead           *bool            `json:"is_read"`
	RelDocs          []any            `json:"rel_docs"`
	Evaluate         int              `json:"evaluate"`
	IsEvaluateEnable bool             `json:"is_evaluate_enable"`
	ToolName         string           `json:"tool_name"`
	ToolArgs         string           `json:"tool_args"`
	ToolTips         []map[string]any `json:"tool_tips,omitempty"`
}

type HermesSendMessageRequest struct {
	SpaceID   string `json:"spaceID"`
	SessionID string `json:"sessionID"`
	MessageID string `json:"messageID"`
	Message   string `json:"message"`
}

type HermesSendMessageResponse struct {
	Sequence int    `json:"sequence"`
	AnswerID string `json:"answer_id"`
}

type HermesRenameSessionResponse struct {
	SessionID string `json:"session_id"`
	Name      string `json:"name"`
}

type hermesDesktopStore struct {
	Sessions   []HermesSession                  `json:"sessions"`
	Histories  map[string][]HermesMessageDetail `json:"histories"`
	MessageSeq map[string]int                   `json:"message_seq"`
}

type rpcRequest struct {
	JSONRPC string         `json:"jsonrpc"`
	ID      int64          `json:"id"`
	Method  string         `json:"method"`
	Params  map[string]any `json:"params"`
}

type rpcResponse struct {
	Result json.RawMessage `json:"result"`
	Error  *rpcError       `json:"error"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type rpcFrame struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      *int64          `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
	Result  json.RawMessage `json:"result"`
	Error   *rpcError       `json:"error"`
}

type gatewayEvent struct {
	Type      string          `json:"type"`
	SessionID string          `json:"session_id"`
	Payload   json.RawMessage `json:"payload"`
}

type activeTurn struct {
	MessageID       string
	Text            string
	Initialized     bool
	NeedsNewSegment bool
}

type hermesProviderDetails struct {
	ModelName     string
	BaseURL       string
	APIKeyPresent bool
}

type hermesProviderRuntimeConfig struct {
	ModelName string
	Provider  string
	BaseURL   string
	APIKey    string
	APIMode   string
}

type processLogBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *processLogBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *processLogBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func NewHermesAgentService() *HermesAgentService {
	return &HermesAgentService{
		pending:     map[int64]chan rpcResponse{},
		sessions:    map[string]*HermesSession{},
		histories:   map[string][]HermesMessageDetail{},
		messageSeq:  map[string]int{},
		activeTurns: map[string]*activeTurn{},
		restored:    map[string]bool{},
	}
}

func (h *HermesAgentService) SetContext(ctx context.Context) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.ctx = ctx
}

func normalizeQukaTokenType(req HermesConfigureRequest) string {
	switch strings.ToLower(strings.TrimSpace(req.TokenType)) {
	case "access", "access_token", "x-access-token":
		return "access"
	case "authorization", "auth", "auth_token", "login", "session", "x-authorization":
		return "authorization"
	}
	if strings.TrimSpace(req.AccessToken) != "" && strings.TrimSpace(req.AuthToken) == "" {
		return "access"
	}
	if strings.TrimSpace(req.AuthToken) != "" && strings.TrimSpace(req.AccessToken) == "" {
		return "authorization"
	}
	if strings.TrimSpace(req.AccessToken) != "" {
		return "access"
	}
	return "authorization"
}

func qukaTokenValue(req HermesConfigureRequest) string {
	if normalizeQukaTokenType(req) == "access" {
		if token := strings.TrimSpace(req.AccessToken); token != "" {
			return token
		}
		return strings.TrimSpace(req.AuthToken)
	}
	if token := strings.TrimSpace(req.AuthToken); token != "" {
		return token
	}
	return strings.TrimSpace(req.AccessToken)
}

func normalizeQukaAPIBaseURL(raw string) string {
	value := strings.TrimRight(strings.TrimSpace(raw), "/")
	if value == "" {
		return ""
	}

	if parsed, err := url.Parse(value); err == nil && parsed.Scheme != "" && parsed.Host != "" {
		parsed.RawQuery = ""
		parsed.Fragment = ""
		parsed.RawPath = ""
		path := strings.TrimRight(parsed.Path, "/")
		lowerPath := strings.ToLower(path)
		switch {
		case lowerPath == "/api/v1" || strings.HasPrefix(lowerPath, "/api/v1/"):
			parsed.Path = path
		case lowerPath == "/api":
			parsed.Path = path + "/v1"
		default:
			parsed.Path = path + "/api/v1"
		}
		return strings.TrimRight(parsed.String(), "/")
	}

	lower := strings.ToLower(value)
	if strings.Contains(lower+"/", "/api/v1/") {
		return value
	}
	if strings.HasSuffix(lower, "/api") {
		return value + "/v1"
	}
	return value + "/api/v1"
}

func (h *HermesAgentService) Configure(req HermesConfigureRequest) (*HermesStatus, error) {
	req.Host = strings.TrimSpace(req.Host)
	req.AccessToken = strings.TrimSpace(req.AccessToken)
	req.APIBaseURL = strings.TrimSpace(req.APIBaseURL)
	req.AuthToken = strings.TrimSpace(req.AuthToken)
	req.TokenType = normalizeQukaTokenType(req)
	if req.TokenType == "access" {
		req.AuthToken = ""
	} else {
		req.AccessToken = ""
	}
	req.SpaceID = strings.TrimSpace(req.SpaceID)
	req.Resource = strings.TrimSpace(req.Resource)
	if req.APIBaseURL == "" {
		req.APIBaseURL = req.Host
	}
	if req.Host == "" {
		req.Host = req.APIBaseURL
	}
	if req.APIBaseURL == "" {
		return nil, errors.New("quka-ai api base url is required")
	}
	if req.SpaceID == "" {
		return nil, errors.New("space id is required")
	}
	if qukaTokenValue(req) == "" {
		return nil, errors.New("auth token is required for quka-ai skill")
	}
	if req.Resource == "" {
		req.Resource = "knowledge"
	}

	h.mu.Lock()
	h.config = req
	h.mu.Unlock()

	if err := ensureHermesBundledSkillsConfigured(); err != nil {
		return nil, err
	}
	if err := ensureQukaMemoryProviderInstalled(); err != nil {
		return nil, err
	}
	if err := writeQukaSkillConfig(req); err != nil {
		return nil, err
	}
	if err := writeQukaMemoryProviderConfig(req); err != nil {
		return nil, err
	}
	if err := enableQukaMemoryProvider(); err != nil {
		return nil, err
	}

	h.mu.Lock()
	status := &HermesStatus{Ready: h.conn != nil, BaseURL: h.baseURL, Mode: "local"}
	h.mu.Unlock()
	hermesLogf("quka skill and memory provider config saved for space=%q resource=%q; bridge start deferred ready=%t", req.SpaceID, req.Resource, status.Ready)
	h.reloadConnectedRuntimeConfig("quka context updated")
	return status, nil
}

func (h *HermesAgentService) ConfigureProvider(req HermesProviderConfigureRequest) (*HermesStatus, error) {
	req.ModelName = strings.TrimSpace(req.ModelName)
	req.BaseURL = strings.TrimSpace(req.BaseURL)
	req.APIKey = strings.TrimSpace(req.APIKey)
	req.TavilyAPIKey = strings.TrimSpace(req.TavilyAPIKey)
	hermesLogf("provider configure requested model=%q baseURL=%q apiKeyPresent=%t tavilyKeyPresent=%t", req.ModelName, req.BaseURL, req.APIKey != "", req.TavilyAPIKey != "")

	if req.ModelName == "" {
		return nil, errors.New("model name is required")
	}
	if req.BaseURL == "" {
		return nil, errors.New("model base url is required")
	}
	parsedBaseURL, err := url.Parse(req.BaseURL)
	if err != nil || parsedBaseURL.Scheme == "" || parsedBaseURL.Host == "" {
		return nil, errors.New("model base url must be a valid absolute URL")
	}
	if parsedBaseURL.Scheme != "http" && parsedBaseURL.Scheme != "https" {
		return nil, errors.New("model base url must use http or https")
	}
	if req.APIKey == "" {
		stored, err := hermesProviderStoredConfig()
		if err != nil {
			return nil, err
		}
		if !stored.APIKeyConfigured {
			return nil, errors.New("model api key is required")
		}
	}

	if err := writeHermesProviderConfig(req); err != nil {
		hermesLogf("failed to write provider config: %v", err)
		return nil, err
	}
	if err := writeHermesEnv(req); err != nil {
		hermesLogf("failed to write provider env: %v", err)
		return nil, err
	}
	hermesLogf("provider config saved; applying bridge provider configuration in background")

	go func() {
		hermesLogf("background provider apply begin")
		status, err := h.reloadProviderOrStart(req)
		if err != nil {
			hermesLogf("background provider apply failed: %v", err)
			h.emitStatus(false, "", "starting", err.Error())
			return
		}
		hermesLogf("background provider apply completed ready=%t baseURL=%q mode=%q", status.Ready, status.BaseURL, status.Mode)
		h.emitStatus(status.Ready, status.BaseURL, status.Mode, "")
	}()

	return &HermesStatus{Ready: false, BaseURL: "", Mode: "reloading"}, nil
}

func (h *HermesAgentService) HasProviderConfigured() bool {
	configured, details, err := hermesProviderConfiguredDetails()
	if err != nil {
		hermesLogf("provider configured check failed: %v", err)
		return false
	}
	hermesLogf("provider configured check: configured=%t model=%q baseURL=%q apiKeyPresent=%t", configured, details.ModelName, details.BaseURL, details.APIKeyPresent)
	return configured
}

func (h *HermesAgentService) ProviderConfig() (*HermesProviderStoredConfig, error) {
	config, err := hermesProviderStoredConfig()
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func (h *HermesAgentService) EnvironmentVariables() ([]HermesEnvironmentVariable, error) {
	variables, err := hermesUserEnvironmentVariables()
	if err != nil {
		return nil, err
	}
	return variables, nil
}

func (h *HermesAgentService) ConfigureEnvironment(req HermesEnvironmentConfigureRequest) ([]HermesEnvironmentVariable, error) {
	updates, removals, err := writeHermesUserEnvironment(req.Variables)
	if err != nil {
		return nil, err
	}
	if err := h.reloadConnectedEnvironment(updates, removals); err != nil {
		return nil, err
	}
	return h.EnvironmentVariables()
}

func (h *HermesAgentService) Skills() (*HermesSkillList, error) {
	return hermesSkills()
}

func (h *HermesAgentService) ViewSkill(req HermesSkillViewRequest) (*HermesSkillContent, error) {
	return hermesSkillContent(req)
}

func (h *HermesAgentService) ReloadSkills() (*HermesSkillList, error) {
	if err := ensureHermesBundledSkillsConfigured(); err != nil {
		return nil, err
	}
	h.reloadConnectedRuntimeConfig("skills reloaded")
	return h.Skills()
}

func (h *HermesAgentService) InstallSkill(req HermesSkillInstallRequest) (*HermesSkillList, error) {
	if err := hermesInstallSkill(req); err != nil {
		return nil, err
	}
	h.reloadConnectedRuntimeConfig("skill installed")
	return h.Skills()
}

func (h *HermesAgentService) DeleteSkill(req HermesSkillDeleteRequest) (*HermesSkillList, error) {
	if err := hermesDeleteSkill(req); err != nil {
		return nil, err
	}
	h.reloadConnectedRuntimeConfig("skill deleted")
	return h.Skills()
}

func (h *HermesAgentService) ResolveInteraction(req HermesInteractionResolveRequest) error {
	req.RequestID = strings.TrimSpace(req.RequestID)
	req.Action = strings.TrimSpace(req.Action)
	if req.RequestID == "" {
		return errors.New("interaction request id is required")
	}
	if req.Action == "" {
		req.Action = "deny"
	}
	hermesLogf("interaction resolve requested id=%q action=%q valuePresent=%t", req.RequestID, req.Action, req.Value != "")
	var out map[string]any
	if err := h.request("interaction.resolve", map[string]any{
		"request_id": req.RequestID,
		"action":     req.Action,
		"value":      req.Value,
	}, &out); err != nil {
		hermesLogf("interaction resolve failed id=%q: %v", req.RequestID, err)
		return err
	}
	hermesLogf("interaction resolve completed id=%q result=%v", req.RequestID, out)
	return nil
}

func (h *HermesAgentService) StartIfProviderConfigured() {
	startedAt := time.Now()
	configured, details, err := hermesProviderConfiguredDetails()
	if err != nil {
		hermesLogf("app startup: Hermes provider check failed: %v", err)
		return
	}
	if !configured {
		hermesLogf("app startup: Hermes bridge auto start skipped; provider incomplete model=%q baseURL=%q apiKeyPresent=%t", details.ModelName, details.BaseURL, details.APIKeyPresent)
		return
	}
	hermesLogf("app startup: Hermes provider configured; prewarming bridge model=%q baseURL=%q", details.ModelName, details.BaseURL)
	h.emitStatus(false, "", "starting", "")
	status, err := h.Start()
	if err != nil {
		hermesLogf("app startup: Hermes bridge prewarm failed elapsed=%s err=%v", time.Since(startedAt).Round(time.Millisecond), err)
		h.emitStatus(false, "", "starting", err.Error())
		return
	}
	hermesLogf("app startup: Hermes bridge prewarm completed elapsed=%s ready=%t baseURL=%q mode=%q", time.Since(startedAt).Round(time.Millisecond), status.Ready, status.BaseURL, status.Mode)
	h.emitStatus(status.Ready, status.BaseURL, status.Mode, "")
}

func (h *HermesAgentService) Start() (*HermesStatus, error) {
	hermesLogf("start requested")
	hermesLogf("start caller:\n%s", hermesCallerStack())
	if err := ensureHermesBundledSkillsConfigured(); err != nil {
		hermesLogf("start failed configuring bundled Hermes skills: %v", err)
		return nil, err
	}
	if err := ensureQukaMemoryProviderInstalled(); err != nil {
		hermesLogf("start failed installing quka memory provider: %v", err)
		return nil, err
	}
	if configured, err := qukaMemoryProviderConfigured(); err != nil {
		hermesLogf("start failed checking quka memory provider config: %v", err)
		return nil, err
	} else if configured {
		if err := enableQukaMemoryProvider(); err != nil {
			hermesLogf("start failed enabling quka memory provider: %v", err)
			return nil, err
		}
	}
	if err := h.ensureGateway(); err != nil {
		hermesLogf("start failed ensuring gateway: %v", err)
		return nil, err
	}
	h.logRuntimeDiagnostics("start")

	h.mu.Lock()
	defer h.mu.Unlock()
	hermesLogf("start completed ready=%t baseURL=%q", h.conn != nil, h.baseURL)
	return &HermesStatus{Ready: h.conn != nil, BaseURL: h.baseURL, Mode: "local"}, nil
}

func (h *HermesAgentService) Status() *HermesStatus {
	h.mu.Lock()
	defer h.mu.Unlock()

	mode := "stopped"
	if h.conn != nil {
		mode = "local"
	} else if h.proc != nil {
		mode = "starting"
	}

	return &HermesStatus{Ready: h.conn != nil, BaseURL: h.baseURL, Mode: mode}
}

func (h *HermesAgentService) RuntimeDiagnostics() (map[string]any, error) {
	if err := h.ensureGateway(); err != nil {
		return nil, err
	}
	var out map[string]any
	if err := h.request("runtime.inspect", map[string]any{}, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (h *HermesAgentService) reloadProviderOrStart(req HermesProviderConfigureRequest) (*HermesStatus, error) {
	h.mu.Lock()
	connected := h.conn != nil
	baseURL := h.baseURL
	h.mu.Unlock()

	if !connected {
		hermesLogf("provider reload skipped; bridge is not connected, starting bridge")
		return h.Start()
	}

	providerConfig, err := hermesProviderRuntimeConfigFromDisk(req)
	if err != nil {
		return nil, err
	}

	hermesLogf("provider reload requested over RPC baseURL=%q model=%q providerBaseURL=%q apiKeyPresent=%t", baseURL, providerConfig.ModelName, providerConfig.BaseURL, providerConfig.APIKey != "")
	var out struct {
		Model         string   `json:"model"`
		Toolsets      []string `json:"toolsets"`
		Generation    int      `json:"generation"`
		Provider      string   `json:"provider"`
		ProviderURL   string   `json:"base_url"`
		APIKeyPresent bool     `json:"api_key_present"`
	}
	if err := h.request("provider.reload", map[string]any{
		"model":    providerConfig.ModelName,
		"provider": providerConfig.Provider,
		"base_url": providerConfig.BaseURL,
		"api_key":  providerConfig.APIKey,
		"api_mode": providerConfig.APIMode,
	}, &out); err != nil {
		hermesLogf("provider reload RPC failed; restarting bridge as fallback: %v", err)
		h.restart()
		return h.Start()
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	hermesLogf("provider reload completed model=%q provider=%q providerBaseURL=%q apiKeyPresent=%t generation=%d baseURL=%q", out.Model, out.Provider, out.ProviderURL, out.APIKeyPresent, out.Generation, h.baseURL)
	return &HermesStatus{Ready: h.conn != nil, BaseURL: h.baseURL, Mode: "local"}, nil
}

func (h *HermesAgentService) reloadConnectedRuntimeConfig(reason string) {
	h.mu.Lock()
	connected := h.conn != nil
	baseURL := h.baseURL
	h.mu.Unlock()
	if !connected {
		return
	}

	go func() {
		hermesLogf("runtime config reload requested reason=%q baseURL=%q", reason, baseURL)
		var out struct {
			Model         string   `json:"model"`
			Toolsets      []string `json:"toolsets"`
			Generation    int      `json:"generation"`
			ProviderURL   string   `json:"base_url"`
			APIKeyPresent bool     `json:"api_key_present"`
		}
		if err := h.request("provider.reload", map[string]any{}, &out); err != nil {
			hermesLogf("runtime config reload failed reason=%q: %v", reason, err)
			return
		}
		hermesLogf("runtime config reload completed reason=%q generation=%d model=%q providerBaseURL=%q apiKeyPresent=%t", reason, out.Generation, out.Model, out.ProviderURL, out.APIKeyPresent)
	}()
}

func (h *HermesAgentService) reloadConnectedEnvironment(updates map[string]string, removals []string) error {
	h.mu.Lock()
	connected := h.conn != nil
	baseURL := h.baseURL
	h.mu.Unlock()
	if !connected {
		return nil
	}

	setValues := map[string]string{}
	for key, value := range updates {
		if isAllowedHermesUserEnvKey(key) {
			setValues[key] = value
		}
	}
	unsetValues := []string{}
	for _, key := range removals {
		if isAllowedHermesUserEnvKey(key) {
			unsetValues = append(unsetValues, key)
		}
	}
	if len(setValues) == 0 && len(unsetValues) == 0 {
		return nil
	}

	hermesLogf("runtime env reload requested baseURL=%q set=%d unset=%d", baseURL, len(setValues), len(unsetValues))
	var out map[string]any
	if err := h.request("runtime.env.reload", map[string]any{"set": setValues, "unset": unsetValues}, &out); err != nil {
		hermesLogf("runtime env reload failed: %v", err)
		return err
	}
	hermesLogf("runtime env reload completed set=%d unset=%d generation=%v", len(setValues), len(unsetValues), out["generation"])
	return nil
}

func (h *HermesAgentService) logRuntimeDiagnostics(reason string) {
	out, err := h.RuntimeDiagnostics()
	if err != nil {
		hermesLogf("runtime diagnostics failed reason=%q: %v", reason, err)
		return
	}
	raw, err := json.Marshal(out)
	if err != nil {
		hermesLogf("runtime diagnostics reason=%q: %+v", reason, out)
		return
	}
	hermesLogf("runtime diagnostics reason=%q %s", reason, string(raw))
}

func hermesCallerStack() string {
	buf := make([]byte, 4096)
	n := runtime.Stack(buf, false)
	lines := strings.Split(string(buf[:n]), "\n")
	if len(lines) <= 4 {
		return strings.TrimSpace(string(buf[:n]))
	}
	end := len(lines)
	if end > 14 {
		end = 14
	}
	return strings.Join(lines[4:end], "\n")
}

func (h *HermesAgentService) emitStatus(ready bool, baseURL string, mode string, errMessage string) {
	h.mu.Lock()
	ctx := h.ctx
	h.mu.Unlock()
	if ctx == nil {
		return
	}
	payload := map[string]any{
		"ready":   ready,
		"baseURL": baseURL,
		"mode":    mode,
	}
	if errMessage != "" {
		payload["error"] = errMessage
	}
	hermesLogf("emit status ready=%t baseURL=%q mode=%q error=%q", ready, baseURL, mode, errMessage)
	wailsruntime.EventsEmit(ctx, "hermes-agent:status", payload)
}

func (h *HermesAgentService) CreateSession(spaceID string) (string, error) {
	if err := h.ensureGateway(); err != nil {
		return "", err
	}

	var out struct {
		SessionID       string `json:"session_id"`
		StoredSessionID string `json:"stored_session_id"`
	}
	if err := h.request("session.create", map[string]any{"title": "Quka Chat"}, &out); err != nil {
		return "", err
	}

	now := time.Now().Unix()
	h.mu.Lock()
	if err := h.ensureStoreLoadedLocked(); err != nil {
		h.mu.Unlock()
		return "", err
	}
	h.sessions[out.SessionID] = &HermesSession{
		ID:               out.SessionID,
		Title:            "New Session",
		SpaceID:          spaceID,
		LatestAccessTime: now,
	}
	h.histories[out.SessionID] = []HermesMessageDetail{}
	h.messageSeq[out.SessionID] = 0
	h.restored[out.SessionID] = true
	saveErr := h.saveStoreLocked()
	h.mu.Unlock()
	if saveErr != nil {
		return "", saveErr
	}

	return out.SessionID, nil
}

func (h *HermesAgentService) ListSessions(spaceID string, page int, pageSize int) (*HermesSessionList, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if err := h.ensureStoreLoadedLocked(); err != nil {
		return nil, err
	}

	items := make([]HermesSession, 0, len(h.sessions))
	for _, session := range h.sessions {
		if session.SpaceID == spaceID {
			items = append(items, *session)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].LatestAccessTime > items[j].LatestAccessTime
	})

	total := len(items)
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	start := (page - 1) * pageSize
	if start >= total {
		return &HermesSessionList{List: []HermesSession{}, Total: total}, nil
	}
	end := start + pageSize
	if end > total {
		end = total
	}

	return &HermesSessionList{List: items[start:end], Total: total}, nil
}

func (h *HermesAgentService) GetSessionHistory(spaceID string, sessionID string, page int, pageSize int) (*HermesMessageList, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if err := h.ensureStoreLoadedLocked(); err != nil {
		return nil, err
	}

	list := append([]HermesMessageDetail(nil), h.histories[sessionID]...)
	total := len(list)
	if pageSize > 0 && page > 0 {
		start := (page - 1) * pageSize
		if start >= total {
			return &HermesMessageList{List: []HermesMessageDetail{}, Total: total}, nil
		}
		end := start + pageSize
		if end > total {
			end = total
		}
		list = list[start:end]
	}
	return &HermesMessageList{List: list, Total: total}, nil
}

func (h *HermesAgentService) SendMessage(req HermesSendMessageRequest) (*HermesSendMessageResponse, error) {
	hermesLogf("send message requested space=%q session=%q messageID=%q messageLen=%d", req.SpaceID, req.SessionID, req.MessageID, runeLen(req.Message))
	if err := h.ensureGateway(); err != nil {
		hermesLogf("send message failed ensuring gateway: %v", err)
		return nil, err
	}
	if strings.TrimSpace(req.SessionID) == "" {
		return nil, errors.New("session id is required")
	}
	if err := h.restoreSessionForBridge(req.SessionID); err != nil {
		hermesLogf("send message failed restoring session=%q: %v", req.SessionID, err)
		return nil, err
	}

	answerID := "hermes-answer-" + randomID()
	h.mu.Lock()
	if err := h.ensureStoreLoadedLocked(); err != nil {
		h.mu.Unlock()
		return nil, err
	}
	h.messageSeq[req.SessionID]++
	sequence := h.messageSeq[req.SessionID]
	if session := h.sessions[req.SessionID]; session != nil {
		session.LatestAccessTime = time.Now().Unix()
		if session.Title == "New Session" && strings.TrimSpace(req.Message) != "" {
			session.Title = titleFromMessage(req.Message)
		}
	}
	h.activeTurns[req.SessionID] = &activeTurn{MessageID: answerID}
	h.recordUserMessageLocked(req, sequence)
	err := h.saveStoreLocked()
	h.mu.Unlock()
	if err != nil {
		return nil, err
	}

	if err := h.request("prompt.submit", map[string]any{
		"session_id": req.SessionID,
		"text":       req.Message,
	}, nil); err != nil {
		hermesLogf("send message prompt.submit failed session=%q: %v", req.SessionID, err)
		h.mu.Lock()
		h.deleteHistoryMessageLocked(req.SessionID, req.MessageID)
		if saveErr := h.saveStoreLocked(); saveErr != nil {
			hermesLogf("failed to remove unsent user message from store: %v", saveErr)
		}
		h.mu.Unlock()
		return nil, err
	}

	hermesLogf("send message submitted session=%q sequence=%d answerID=%q", req.SessionID, sequence, answerID)
	return &HermesSendMessageResponse{Sequence: sequence, AnswerID: answerID}, nil
}

func (h *HermesAgentService) StopSession(sessionID string) error {
	if err := h.ensureGateway(); err != nil {
		return err
	}
	return h.request("session.interrupt", map[string]any{"session_id": sessionID}, nil)
}

func (h *HermesAgentService) RenameSession(spaceID string, sessionID string, firstMessage string) (*HermesRenameSessionResponse, error) {
	title := titleFromMessage(firstMessage)
	if title == "" {
		title = "New Session"
	}
	h.mu.Lock()
	if err := h.ensureStoreLoadedLocked(); err != nil {
		h.mu.Unlock()
		return nil, err
	}
	if session := h.sessions[sessionID]; session != nil {
		session.Title = title
		session.LatestAccessTime = time.Now().Unix()
	}
	err := h.saveStoreLocked()
	h.mu.Unlock()
	if err != nil {
		return nil, err
	}

	if h.ensureGateway() == nil {
		_ = h.request("session.title", map[string]any{"session_id": sessionID, "title": title}, nil)
	}

	return &HermesRenameSessionResponse{SessionID: sessionID, Name: title}, nil
}

func (h *HermesAgentService) DeleteSession(spaceID string, sessionID string) error {
	h.mu.Lock()
	if err := h.ensureStoreLoadedLocked(); err != nil {
		h.mu.Unlock()
		return err
	}
	delete(h.sessions, sessionID)
	delete(h.histories, sessionID)
	delete(h.messageSeq, sessionID)
	delete(h.activeTurns, sessionID)
	delete(h.restored, sessionID)
	err := h.saveStoreLocked()
	h.mu.Unlock()
	if err != nil {
		return err
	}

	if h.ensureGateway() == nil {
		_ = h.request("session.close", map[string]any{"session_id": sessionID}, nil)
	}
	return nil
}

func (h *HermesAgentService) restoreSessionForBridge(sessionID string) error {
	h.mu.Lock()
	if err := h.ensureStoreLoadedLocked(); err != nil {
		h.mu.Unlock()
		return err
	}
	if h.restored[sessionID] {
		h.mu.Unlock()
		return nil
	}
	session := h.sessions[sessionID]
	history := append([]HermesMessageDetail(nil), h.histories[sessionID]...)
	h.mu.Unlock()

	if session == nil {
		return nil
	}
	if err := h.request("session.restore", map[string]any{
		"session_id": sessionID,
		"title":      session.Title,
		"messages":   hermesAgentHistoryFromQukaMessages(history),
	}, nil); err != nil {
		return err
	}

	h.mu.Lock()
	h.restored[sessionID] = true
	h.mu.Unlock()
	return nil
}

func (h *HermesAgentService) ensureStoreLoadedLocked() error {
	if h.storeLoaded {
		return nil
	}
	path, err := hermesDesktopStorePath()
	if err != nil {
		return err
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			h.storeLoaded = true
			return nil
		}
		return err
	}
	store := hermesDesktopStore{}
	if err := json.Unmarshal(raw, &store); err != nil {
		return fmt.Errorf("failed to read Hermes desktop session store: %w", err)
	}
	if h.sessions == nil {
		h.sessions = map[string]*HermesSession{}
	}
	if h.histories == nil {
		h.histories = map[string][]HermesMessageDetail{}
	}
	if h.messageSeq == nil {
		h.messageSeq = map[string]int{}
	}
	for idx := range store.Sessions {
		session := store.Sessions[idx]
		h.sessions[session.ID] = &session
	}
	for sessionID, history := range store.Histories {
		h.histories[sessionID] = append([]HermesMessageDetail(nil), history...)
		if h.messageSeq[sessionID] == 0 {
			h.messageSeq[sessionID] = maxHermesMessageSequence(history)
		}
	}
	for sessionID, sequence := range store.MessageSeq {
		if sequence > h.messageSeq[sessionID] {
			h.messageSeq[sessionID] = sequence
		}
	}
	h.storeLoaded = true
	hermesLogf("desktop session store loaded sessions=%d histories=%d", len(h.sessions), len(h.histories))
	return nil
}

func (h *HermesAgentService) saveStoreLocked() error {
	path, err := hermesDesktopStorePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	sessions := make([]HermesSession, 0, len(h.sessions))
	for _, session := range h.sessions {
		if session != nil {
			sessions = append(sessions, *session)
		}
	}
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].LatestAccessTime > sessions[j].LatestAccessTime
	})
	store := hermesDesktopStore{
		Sessions:   sessions,
		Histories:  h.histories,
		MessageSeq: h.messageSeq,
	}
	raw, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, raw, 0600)
}

func (h *HermesAgentService) recordUserMessageLocked(req HermesSendMessageRequest, sequence int) {
	h.upsertHistoryMessageLocked(req.SessionID, HermesMessageDetail{
		Meta: HermesMessageMeta{
			MessageID:   req.MessageID,
			Sequence:    sequence,
			SendTime:    time.Now().Unix(),
			Role:        1,
			SessionID:   req.SessionID,
			Complete:    1,
			MessageType: 1,
			Message:     map[string]any{"text": req.Message},
			Attach:      []any{},
		},
		Ext: HermesMessageExt{RelDocs: []any{}},
	})
}

func hermesMessagePayload(text string, protectedText string) map[string]any {
	payload := map[string]any{"text": text}
	if protectedText != "" && protectedText != text {
		payload["provider_text"] = protectedText
	}
	return payload
}

func (h *HermesAgentService) recordAssistantDelta(sessionID string, messageID string, spaceID string, sequence int, text string, protectedText string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if err := h.ensureStoreLoadedLocked(); err != nil {
		hermesLogf("failed to load session store for assistant delta: %v", err)
		return
	}
	if session := h.sessions[sessionID]; session != nil {
		if spaceID != "" {
			session.SpaceID = spaceID
		}
		session.LatestAccessTime = time.Now().Unix()
	}
	idx := h.historyMessageIndexLocked(sessionID, messageID)
	if idx < 0 {
		if sequence <= 0 {
			sequence = h.messageSeq[sessionID]
		}
		h.upsertHistoryMessageLocked(sessionID, HermesMessageDetail{
			Meta: HermesMessageMeta{
				MessageID:   messageID,
				Sequence:    sequence,
				SendTime:    time.Now().Unix(),
				Role:        2,
				SessionID:   sessionID,
				Complete:    0,
				MessageType: 1,
				Message:     hermesMessagePayload(text, protectedText),
				Attach:      []any{},
			},
			Ext: HermesMessageExt{RelDocs: []any{}},
		})
		return
	}
	current := stringValue(h.histories[sessionID][idx].Meta.Message["text"])
	h.histories[sessionID][idx].Meta.Message["text"] = current + text
	currentProtected := stringValue(h.histories[sessionID][idx].Meta.Message["provider_text"])
	if protectedText != "" || currentProtected != "" {
		h.histories[sessionID][idx].Meta.Message["provider_text"] = currentProtected + protectedText
	}
	h.histories[sessionID][idx].Meta.SendTime = time.Now().Unix()
}

func (h *HermesAgentService) recordAssistantComplete(sessionID string, messageID string, failed bool, message string, protectedMessage string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if err := h.ensureStoreLoadedLocked(); err != nil {
		hermesLogf("failed to load session store for assistant complete: %v", err)
		return
	}
	idx := h.historyMessageIndexLocked(sessionID, messageID)
	if idx < 0 && message != "" {
		h.upsertHistoryMessageLocked(sessionID, HermesMessageDetail{
			Meta: HermesMessageMeta{
				MessageID:   messageID,
				Sequence:    h.messageSeq[sessionID],
				SendTime:    time.Now().Unix(),
				Role:        2,
				SessionID:   sessionID,
				Complete:    4,
				MessageType: 1,
				Message:     hermesMessagePayload(message, protectedMessage),
				Attach:      []any{},
			},
			Ext: HermesMessageExt{RelDocs: []any{}},
		})
		idx = h.historyMessageIndexLocked(sessionID, messageID)
	}
	if idx >= 0 {
		if failed {
			h.histories[sessionID][idx].Meta.Complete = 4
			if message != "" {
				h.histories[sessionID][idx].Meta.Message["text"] = message
				if protectedMessage != "" && protectedMessage != message {
					h.histories[sessionID][idx].Meta.Message["provider_text"] = protectedMessage
				}
			}
		} else {
			h.histories[sessionID][idx].Meta.Complete = 1
			if protectedMessage != "" && protectedMessage != message && stringValue(h.histories[sessionID][idx].Meta.Message["provider_text"]) == "" {
				h.histories[sessionID][idx].Meta.Message["provider_text"] = protectedMessage
			}
		}
		h.histories[sessionID][idx].Meta.SendTime = time.Now().Unix()
	}
	if err := h.saveStoreLocked(); err != nil {
		hermesLogf("failed to save session store for assistant complete: %v", err)
	}
}

func (h *HermesAgentService) recordToolMessage(sessionID string, toolID string, toolName string, status int, content string, complete bool, toolTips map[string]any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if err := h.ensureStoreLoadedLocked(); err != nil {
		hermesLogf("failed to load session store for tool message: %v", err)
		return
	}
	idx := h.historyMessageIndexLocked(sessionID, toolID)
	completeValue := 0
	if complete {
		completeValue = 1
		if status == 3 {
			completeValue = 4
		}
	}
	if idx < 0 {
		ext := HermesMessageExt{RelDocs: []any{}, ToolName: toolName}
		if toolTips != nil {
			ext.ToolTips = []map[string]any{toolTips}
			ext.ToolArgs = strings.TrimSpace(stringValue(toolTips["arguments_text"]))
		}
		h.upsertHistoryMessageLocked(sessionID, HermesMessageDetail{
			Meta: HermesMessageMeta{
				MessageID:   toolID,
				Sequence:    h.messageSeq[sessionID],
				SendTime:    time.Now().Unix(),
				Role:        4,
				SessionID:   sessionID,
				Complete:    completeValue,
				MessageType: 2,
				Message:     map[string]any{"text": content},
				Attach:      []any{},
			},
			Ext: ext,
		})
	} else {
		h.histories[sessionID][idx].Meta.Complete = completeValue
		h.histories[sessionID][idx].Meta.Message["text"] = content
		h.histories[sessionID][idx].Meta.SendTime = time.Now().Unix()
		h.histories[sessionID][idx].Ext.ToolName = toolName
		if toolTips != nil {
			h.histories[sessionID][idx].Ext.ToolTips = []map[string]any{toolTips}
			h.histories[sessionID][idx].Ext.ToolArgs = strings.TrimSpace(stringValue(toolTips["arguments_text"]))
		}
	}
	if complete {
		if err := h.saveStoreLocked(); err != nil {
			hermesLogf("failed to save session store for tool message: %v", err)
		}
	}
}

func (h *HermesAgentService) upsertHistoryMessageLocked(sessionID string, message HermesMessageDetail) {
	idx := h.historyMessageIndexLocked(sessionID, message.Meta.MessageID)
	if idx >= 0 {
		h.histories[sessionID][idx] = message
		return
	}
	h.histories[sessionID] = append(h.histories[sessionID], message)
}

func (h *HermesAgentService) historyMessageIndexLocked(sessionID string, messageID string) int {
	for idx, item := range h.histories[sessionID] {
		if item.Meta.MessageID == messageID {
			return idx
		}
	}
	return -1
}

func (h *HermesAgentService) deleteHistoryMessageLocked(sessionID string, messageID string) {
	idx := h.historyMessageIndexLocked(sessionID, messageID)
	if idx < 0 {
		return
	}
	h.histories[sessionID] = append(h.histories[sessionID][:idx], h.histories[sessionID][idx+1:]...)
}

func (h *HermesAgentService) ensureGateway() error {
	h.mu.Lock()
	if h.conn != nil {
		hermesLogf("ensure gateway skipped; already connected baseURL=%q", h.baseURL)
		h.mu.Unlock()
		return nil
	}
	h.mu.Unlock()

	h.mu.Lock()
	defer h.mu.Unlock()
	if h.conn != nil {
		hermesLogf("ensure gateway skipped after lock; already connected baseURL=%q", h.baseURL)
		return nil
	}

	if err := migrateHermesProviderConfig(); err != nil {
		hermesLogf("failed to prepare provider config: %v", err)
		return err
	}

	port, err := pickPort()
	if err != nil {
		hermesLogf("failed to pick port: %v", err)
		return err
	}
	token := randomID()
	baseURL := fmt.Sprintf("http://127.0.0.1:%d", port)
	wsURL := fmt.Sprintf("ws://127.0.0.1:%d/api/ws?token=%s", port, token)

	hermesBin, err := resolveHermesBridgeExecutable()
	if err != nil {
		hermesLogf("failed to resolve bridge executable: %v", err)
		return err
	}
	hermesHome, err := hermesHomeDir()
	if err != nil {
		hermesLogf("failed to resolve hermes home: %v", err)
		return err
	}
	processHome, err := hermesProcessHome(hermesHome)
	if err != nil {
		hermesLogf("failed to resolve hermes process home: %v", err)
		return err
	}
	tmpDir, err := qukaDesktopTmpDir(hermesHome)
	if err != nil {
		hermesLogf("failed to prepare desktop tmp dir: %v", err)
		return err
	}
	hermesLogf("starting bridge bin=%q home=%q processHome=%q qukaConfig=%q baseURL=%q", hermesBin, hermesHome, processHome, filepath.Join(hermesHome, "quka-ai", "config.json"), baseURL)

	modelName, err := hermesConfiguredModelName()
	if err != nil {
		hermesLogf("failed to read configured model name, using bridge default: %v", err)
	}
	args := []string{"--host", "127.0.0.1", "--port", fmt.Sprintf("%d", port), "--token=" + token}
	if modelName != "" {
		args = append(args, "--model="+modelName)
	}
	cmd := exec.Command(hermesBin, args...)
	if runtime.GOOS != "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	}
	cmd.Env = append(cleanHermesBridgeEnv(os.Environ()),
		"HOME="+processHome,
		"USERPROFILE="+processHome,
		"HERMES_HOME="+hermesHome,
		"QUKA_HERMES_HOME="+hermesHome,
		"HERMES_PLATFORM=desktop",
		"HERMES_SESSION_PLATFORM=desktop",
		"HERMES_INTERACTIVE=1",
		"HERMES_KANBAN_HOME="+filepath.Join(hermesHome, "kanban"),
		"QUKA_AI_CONFIG="+filepath.Join(hermesHome, "quka-ai", "config.json"),
		"QUKA_DESKTOP_TMP_ROOT="+filepath.Dir(tmpDir),
		"QUKA_DESKTOP_TMP_DIR="+tmpDir,
		"HERMES_DASHBOARD_SESSION_TOKEN="+token,
		"PYINSTALLER_RESET_ENVIRONMENT=1",
	)
	if pluginDir := filepath.Join(filepath.Dir(hermesBin), "plugins"); isDir(pluginDir) {
		cmd.Env = append(cmd.Env, "HERMES_BUNDLED_PLUGINS="+pluginDir)
	}
	startupLogs := &processLogBuffer{}
	cmd.Stdout = io.MultiWriter(startupLogs, os.Stdout)
	cmd.Stderr = io.MultiWriter(startupLogs, os.Stderr)
	startedAt := time.Now()
	if err := cmd.Start(); err != nil {
		hermesLogf("failed to start bridge process: %v", err)
		return fmt.Errorf("failed to start embedded Hermes bridge: %w", err)
	}
	hermesLogf("bridge process started pid=%d wsURL=%q model=%q", cmd.Process.Pid, wsURL, modelName)

	h.proc = cmd
	h.baseURL = baseURL
	h.wsURL = wsURL
	h.token = token

	waitCh := make(chan error, 1)
	go func() {
		err := cmd.Wait()
		hermesLogf("bridge process exited pid=%d err=%v", cmd.Process.Pid, err)
		waitCh <- err
		h.mu.Lock()
		if h.proc == cmd {
			h.conn = nil
			h.proc = nil
		}
		h.mu.Unlock()
	}()

	conn, err := waitForHermesWebSocket(wsURL, waitCh, startupLogs)
	if err != nil {
		hermesLogf("bridge websocket wait failed: %v", err)
		h.stopLocked()
		return err
	}
	h.conn = conn
	hermesLogf("bridge websocket connected baseURL=%q elapsed=%s", baseURL, time.Since(startedAt).Round(time.Millisecond))

	go h.readLoop(conn)

	return nil
}

func resolveHermesBridgeExecutable() (string, error) {
	if value := strings.TrimSpace(os.Getenv("HERMES_BRIDGE_BIN")); value != "" {
		if resolved, ok := executableFromPathOrDir(value); ok {
			return resolved, nil
		}
		return "", fmt.Errorf("HERMES_BRIDGE_BIN points to a non-executable file: %s", value)
	}

	for _, candidate := range bundledHermesBridgeCandidates() {
		if isExecutableFile(candidate) {
			return candidate, nil
		}
	}

	if value, err := exec.LookPath("quka-hermes-bridge"); err == nil && value != "" {
		return value, nil
	}

	candidates := []string{}
	if home, err := os.UserHomeDir(); err == nil {
		candidates = append(candidates,
			filepath.Join(home, ".local", "bin", "quka-hermes-bridge"),
			filepath.Join(home, ".hermes", "bin", "quka-hermes-bridge"),
		)
	}
	candidates = append(candidates,
		"/opt/homebrew/bin/quka-hermes-bridge",
		"/usr/local/bin/quka-hermes-bridge",
	)

	for _, candidate := range candidates {
		if isExecutableFile(candidate) {
			return candidate, nil
		}
	}

	for _, shell := range []string{"/bin/zsh", "/bin/bash"} {
		if !isExecutableFile(shell) {
			continue
		}
		out, err := exec.Command(shell, "-lc", "command -v quka-hermes-bridge").Output()
		if err != nil {
			continue
		}
		value := strings.TrimSpace(string(out))
		if value != "" && isExecutableFile(value) {
			return value, nil
		}
	}

	return "", errors.New("embedded Hermes bridge not found. Build the desktop app with quka-desktop/build-hermes-runtime.sh, or set HERMES_BRIDGE_BIN to quka-hermes-bridge")
}

func executableFromPathOrDir(path string) (string, bool) {
	if isExecutableFile(path) {
		return path, true
	}
	info, err := os.Stat(path)
	if err != nil || !info.IsDir() {
		return "", false
	}
	candidate := filepath.Join(path, "quka-hermes-bridge")
	if isExecutableFile(candidate) {
		return candidate, true
	}
	return "", false
}

func bundledHermesBridgeCandidates() []string {
	var roots []string

	if cwd, err := os.Getwd(); err == nil {
		roots = append(roots,
			filepath.Join(cwd, "build", "hermes-runtime-build"),
			filepath.Join(cwd, "hermes-runtime"),
			filepath.Join(cwd, "hermes-agent"),
			filepath.Join(cwd, "build", "hermes-agent"),
		)
	}

	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		roots = append(roots, filepath.Join(exeDir, "hermes-agent"))
		if filepath.Base(exeDir) == "MacOS" && filepath.Base(filepath.Dir(exeDir)) == "Contents" {
			roots = append(roots, filepath.Join(filepath.Dir(exeDir), "Resources", "hermes-agent"))
		}
	}

	candidates := make([]string, 0, len(roots)*4)
	for _, root := range roots {
		candidates = append(candidates,
			filepath.Join(root, "quka-hermes-bridge"),
			filepath.Join(root, "bin", "quka-hermes-bridge"),
			filepath.Join(root, "dist", "quka-hermes-bridge", "quka-hermes-bridge"),
			filepath.Join(root, "dist", "quka-hermes-bridge"),
		)
	}

	return candidates
}

func resolveHermesBundledSkillsDir() (string, error) {
	candidates := bundledHermesSkillsCandidates()
	for _, candidate := range candidates {
		if isDir(candidate) && hasSkillFile(filepath.Join(candidate, "quka-ai")) && hasSkillFile(filepath.Join(candidate, "quka-journal")) {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("bundled Hermes skills not found; expected quka-ai and quka-journal in one of: %s", strings.Join(candidates, ", "))
}

func bundledHermesSkillsCandidates() []string {
	candidates := []string{}
	if value := strings.TrimSpace(os.Getenv("HERMES_BUNDLED_SKILLS_DIR")); value != "" {
		candidates = append(candidates, value)
	}
	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(cwd, "hermes-runtime", "skills"),
			filepath.Join(cwd, "hermes-agent", "skills"),
			filepath.Join(cwd, "build", "hermes-agent", "skills"),
			filepath.Join(cwd, "build", "bin", "QukaAI.app", "Contents", "Resources", "hermes-agent", "skills"),
		)
	}
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		candidates = append(candidates, filepath.Join(exeDir, "hermes-agent", "skills"))
		if filepath.Base(exeDir) == "MacOS" && filepath.Base(filepath.Dir(exeDir)) == "Contents" {
			candidates = append(candidates, filepath.Join(filepath.Dir(exeDir), "Resources", "hermes-agent", "skills"))
		}
	}
	if bridge, err := resolveHermesBridgeExecutable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(bridge), "skills"))
	}
	return dedupeStrings(candidates)
}

func hasSkillFile(root string) bool {
	return isFile(filepath.Join(root, "SKILL.md"))
}

func dedupeStrings(values []string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		out = append(out, value)
	}
	return out
}

func cleanHermesBridgeEnv(env []string) []string {
	cleaned := make([]string, 0, len(env))
	for _, item := range env {
		key, _, ok := strings.Cut(item, "=")
		if !ok {
			continue
		}
		if strings.HasPrefix(key, "_PYI_") || key == "PYINSTALLER_RESET_ENVIRONMENT" ||
			key == "HOME" || key == "USERPROFILE" || key == "HERMES_HOME" || key == "HERMES_KANBAN_HOME" {
			continue
		}
		cleaned = append(cleaned, item)
	}
	return cleaned
}

func isExecutableFile(path string) bool {
	if strings.TrimSpace(path) == "" {
		return false
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return false
	}
	if runtime.GOOS == "windows" {
		return true
	}
	return info.Mode()&0111 != 0
}

func isDir(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func isFile(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func hermesProcessHome(hermesHome string) (string, error) {
	if home, err := os.UserHomeDir(); err == nil && strings.TrimSpace(home) != "" {
		return home, nil
	}
	hermesLogf("failed to resolve user home; falling back to isolated hermes process home")
	return prepareHermesProcessHome(hermesHome)
}

func prepareHermesProcessHome(hermesHome string) (string, error) {
	processHome := filepath.Join(hermesHome, "process-home")
	if err := os.MkdirAll(processHome, 0700); err != nil {
		return "", err
	}
	dotHermes := filepath.Join(processHome, ".hermes")
	if info, err := os.Lstat(dotHermes); err == nil {
		if info.Mode()&os.ModeSymlink != 0 {
			target, readErr := os.Readlink(dotHermes)
			if readErr == nil && target == hermesHome {
				return processHome, nil
			}
			if err := os.Remove(dotHermes); err != nil {
				return "", err
			}
		} else {
			return processHome, nil
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	if runtime.GOOS == "windows" {
		if err := os.MkdirAll(dotHermes, 0700); err != nil {
			return "", err
		}
		return processHome, nil
	}
	if err := os.Symlink(hermesHome, dotHermes); err != nil {
		return "", err
	}
	return processHome, nil
}

func (h *HermesAgentService) restart() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.stopLocked()
}

func (h *HermesAgentService) Stop() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.stopLocked()
}

func (h *HermesAgentService) stopLocked() {
	if h.conn != nil {
		_ = h.conn.Close()
		h.conn = nil
	}
	if h.proc != nil && h.proc.Process != nil {
		pid := h.proc.Process.Pid
		if runtime.GOOS != "windows" {
			if err := syscall.Kill(-pid, syscall.SIGKILL); err != nil {
				hermesLogf("failed to kill bridge process group pid=%d: %v", pid, err)
				_ = h.proc.Process.Kill()
			} else {
				hermesLogf("bridge process group killed pid=%d", pid)
			}
		} else {
			_ = h.proc.Process.Kill()
		}
		h.proc = nil
	}
	for id, ch := range h.pending {
		delete(h.pending, id)
		ch <- rpcResponse{Error: &rpcError{Message: "hermes gateway stopped"}}
	}
}

func (h *HermesAgentService) request(method string, params map[string]any, out any) error {
	h.mu.Lock()
	if h.conn == nil {
		h.mu.Unlock()
		return errors.New("hermes gateway is not connected")
	}
	h.nextID++
	id := h.nextID
	ch := make(chan rpcResponse, 1)
	h.pending[id] = ch
	conn := h.conn
	h.mu.Unlock()

	req := rpcRequest{JSONRPC: "2.0", ID: id, Method: method, Params: params}
	hermesLogf("rpc request send id=%d method=%q", id, method)
	h.writeMu.Lock()
	err := conn.WriteJSON(req)
	h.writeMu.Unlock()
	if err != nil {
		h.mu.Lock()
		delete(h.pending, id)
		h.mu.Unlock()
		hermesLogf("rpc write failed id=%d method=%q: %v", id, method, err)
		return err
	}

	select {
	case resp := <-ch:
		if resp.Error != nil {
			hermesLogf("rpc request error id=%d method=%q error=%q", id, method, resp.Error.Message)
			return errors.New(resp.Error.Message)
		}
		if out != nil && len(resp.Result) > 0 {
			if err := json.Unmarshal(resp.Result, out); err != nil {
				hermesLogf("rpc response unmarshal failed id=%d method=%q: %v", id, method, err)
				return err
			}
		}
		hermesLogf("rpc request completed id=%d method=%q", id, method)
		return nil
	case <-time.After(2 * time.Minute):
		h.mu.Lock()
		delete(h.pending, id)
		h.mu.Unlock()
		hermesLogf("rpc request timed out id=%d method=%q", id, method)
		return fmt.Errorf("hermes request timed out: %s", method)
	}
}

func (h *HermesAgentService) readLoop(conn *websocket.Conn) {
	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			hermesLogf("gateway read loop ended: %v", err)
			h.mu.Lock()
			if h.conn == conn {
				h.conn = nil
			}
			h.mu.Unlock()
			return
		}

		var frame rpcFrame
		if err := json.Unmarshal(raw, &frame); err != nil {
			hermesLogf("gateway frame unmarshal failed: %v rawLen=%d", err, len(raw))
			continue
		}

		if frame.ID != nil {
			h.mu.Lock()
			ch := h.pending[*frame.ID]
			delete(h.pending, *frame.ID)
			h.mu.Unlock()
			if ch != nil {
				ch <- rpcResponse{Result: frame.Result, Error: frame.Error}
			}
			continue
		}

		if frame.Method == "event" {
			var event gatewayEvent
			if err := json.Unmarshal(frame.Params, &event); err == nil {
				hermesLogf("gateway event received type=%q session=%q payloadLen=%d", event.Type, event.SessionID, len(event.Payload))
				h.handleGatewayEvent(event)
			} else {
				hermesLogf("gateway event unmarshal failed: %v", err)
			}
		}
	}
}

func (h *HermesAgentService) handleGatewayEvent(event gatewayEvent) {
	if event.SessionID == "" {
		return
	}

	switch event.Type {
	case "interaction.request":
		h.emitInteraction(event)
	case "message.start":
		messageID, spaceID, sequence := h.ensureTurn(event.SessionID)
		h.emitQukaEvent(eventTurnStart, event.SessionID, messageID, spaceID, sequence, "", 0, nil)
	case "message.delta":
		var payload struct {
			Text          string `json:"text"`
			ProtectedText string `json:"protected_text"`
		}
		_ = json.Unmarshal(event.Payload, &payload)
		messageID, spaceID, sequence, startAt, initNeeded := h.appendAssistantText(event.SessionID, payload.Text)
		h.recordAssistantDelta(event.SessionID, messageID, spaceID, sequence, payload.Text, payload.ProtectedText)
		if initNeeded {
			h.emitQukaEvent(eventAssistantInit, event.SessionID, messageID, spaceID, sequence, "", 0, nil)
		}
		h.emitQukaEvent(eventAssistantContinue, event.SessionID, messageID, "", 0, payload.Text, startAt, nil)
	case "message.complete":
		var payload struct {
			Text          string `json:"text"`
			ProtectedText string `json:"protected_text"`
			Status        string `json:"status"`
		}
		_ = json.Unmarshal(event.Payload, &payload)
		messageID, spaceID, sequence, startAt, textEmpty, initialized := h.assistantCompletionState(event.SessionID)
		if !initialized && payload.Text != "" {
			messageID, spaceID, sequence, startAt, _ = h.appendAssistantText(event.SessionID, payload.Text)
			h.recordAssistantDelta(event.SessionID, messageID, spaceID, sequence, payload.Text, payload.ProtectedText)
			h.emitQukaEvent(eventAssistantInit, event.SessionID, messageID, spaceID, sequence, "", 0, nil)
			h.emitQukaEvent(eventAssistantContinue, event.SessionID, messageID, "", 0, payload.Text, startAt, nil)
			startAt = runeLen(payload.Text)
		} else if textEmpty && payload.Text != "" {
			messageID, _, _, startAt, _ = h.appendAssistantText(event.SessionID, payload.Text)
			h.recordAssistantDelta(event.SessionID, messageID, "", 0, payload.Text, payload.ProtectedText)
			h.emitQukaEvent(eventAssistantContinue, event.SessionID, messageID, "", 0, payload.Text, startAt, nil)
			startAt = runeLen(payload.Text)
		}
		eventType := eventAssistantDone
		message := ""
		if payload.Status == "error" {
			eventType = eventAssistantFailed
			message = payload.Text
		}
		h.recordAssistantComplete(event.SessionID, messageID, eventType == eventAssistantFailed, message, payload.ProtectedText)
		h.emitQukaEvent(eventType, event.SessionID, messageID, "", 0, message, startAt, nil)
		h.emitQukaEvent(eventTurnDone, event.SessionID, messageID, "", 0, "", startAt, nil)
	case "tool.start":
		toolID, toolName := h.toolInfo(event.Payload)
		toolTips := h.toolTipsPayload(event.Payload, 1, fmt.Sprintf("Using tool: %s", toolName))
		h.recordToolMessage(event.SessionID, toolID, toolName, 1, fmt.Sprintf("Using tool: %s", toolName), false, toolTips)
		h.emitQukaEvent(eventToolInit, event.SessionID, toolID, "", 0, "", 0, nil)
		h.emitQukaEvent(eventToolContinue, event.SessionID, toolID, "", 0, "", 0, toolTips)
		h.markToolBoundary(event.SessionID)
	case "tool.progress", "tool.generating":
		toolID, _ := h.toolInfo(event.Payload)
		h.emitQukaEvent(eventToolContinue, event.SessionID, toolID, "", 0, "", 0, h.toolTipsPayload(event.Payload, 1, "Running"))
	case "tool.complete":
		toolID, toolName := h.toolInfo(event.Payload)
		eventType := eventToolDone
		status := 2
		content := ""
		if errorText := h.toolResultError(event.Payload); errorText != "" {
			eventType = eventToolFailed
			status = 3
			content = errorText
		}
		toolTips := h.toolTipsPayload(event.Payload, status, content)
		h.recordToolMessage(event.SessionID, toolID, toolName, status, content, true, toolTips)
		h.emitQukaEvent(eventType, event.SessionID, toolID, "", 0, content, 0, toolTips)
	case "error":
		messageID, _, _, startAt, _, _ := h.assistantCompletionState(event.SessionID)
		h.emitQukaEvent(eventAssistantFailed, event.SessionID, messageID, "", 0, h.eventErrorMessage(event.Payload), startAt, nil)
		h.emitQukaEvent(eventTurnDone, event.SessionID, messageID, "", 0, "", startAt, nil)
	}
}

func (h *HermesAgentService) emitInteraction(event gatewayEvent) {
	var payload HermesInteractionRequest
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		hermesLogf("interaction request unmarshal failed: %v", err)
		return
	}
	if payload.SessionID == "" {
		payload.SessionID = event.SessionID
	}
	if payload.RequestID == "" {
		hermesLogf("interaction request ignored without request_id session=%q", event.SessionID)
		return
	}

	h.mu.Lock()
	ctx := h.ctx
	h.mu.Unlock()
	if ctx == nil {
		hermesLogf("interaction request ignored because app context is unavailable id=%q", payload.RequestID)
		return
	}
	hermesLogf("emit interaction id=%q kind=%q session=%q commandLen=%d", payload.RequestID, payload.Kind, payload.SessionID, runeLen(payload.Command))
	wailsruntime.EventsEmit(ctx, hermesInteractionEventName, payload)
}

func (h *HermesAgentService) ensureTurn(sessionID string) (string, string, int) {
	h.mu.Lock()
	defer h.mu.Unlock()
	turn := h.activeTurns[sessionID]
	if turn == nil {
		turn = &activeTurn{MessageID: "hermes-answer-" + randomID()}
		h.activeTurns[sessionID] = turn
		h.messageSeq[sessionID]++
	}
	spaceID := ""
	if session := h.sessions[sessionID]; session != nil {
		spaceID = session.SpaceID
		session.LatestAccessTime = time.Now().Unix()
	}
	return turn.MessageID, spaceID, h.messageSeq[sessionID]
}

func (h *HermesAgentService) appendAssistantText(sessionID string, text string) (string, string, int, int, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()

	turn := h.activeTurns[sessionID]
	if turn == nil {
		turn = &activeTurn{MessageID: "hermes-answer-" + randomID()}
		h.activeTurns[sessionID] = turn
		h.messageSeq[sessionID]++
	} else if turn.NeedsNewSegment {
		turn.MessageID = "hermes-answer-" + randomID()
		turn.Text = ""
		turn.Initialized = false
		turn.NeedsNewSegment = false
		h.messageSeq[sessionID]++
	}

	spaceID := ""
	if session := h.sessions[sessionID]; session != nil {
		spaceID = session.SpaceID
		session.LatestAccessTime = time.Now().Unix()
	}
	initNeeded := !turn.Initialized
	turn.Initialized = true
	startAt := runeLen(turn.Text)
	turn.Text += text
	return turn.MessageID, spaceID, h.messageSeq[sessionID], startAt, initNeeded
}

func (h *HermesAgentService) assistantCompletionState(sessionID string) (string, string, int, int, bool, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	turn := h.activeTurns[sessionID]
	if turn == nil {
		turn = &activeTurn{MessageID: "hermes-answer-" + randomID()}
		h.activeTurns[sessionID] = turn
		h.messageSeq[sessionID]++
	}
	spaceID := ""
	if session := h.sessions[sessionID]; session != nil {
		spaceID = session.SpaceID
		session.LatestAccessTime = time.Now().Unix()
	}
	return turn.MessageID, spaceID, h.messageSeq[sessionID], runeLen(turn.Text), turn.Text == "", turn.Initialized
}

func (h *HermesAgentService) markToolBoundary(sessionID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if turn := h.activeTurns[sessionID]; turn != nil && turn.Initialized {
		turn.NeedsNewSegment = true
	}
}

func (h *HermesAgentService) toolInfo(raw json.RawMessage) (string, string) {
	var payload map[string]any
	_ = json.Unmarshal(raw, &payload)
	id := stringValue(payload["tool_call_id"])
	if id == "" {
		id = stringValue(payload["id"])
	}
	if id == "" {
		id = "hermes-tool-" + randomID()
	}
	name := stringValue(payload["name"])
	if name == "" {
		name = stringValue(payload["tool_name"])
	}
	if name == "" {
		name = "tool"
	}
	return id, name
}

func (h *HermesAgentService) toolTipsPayload(raw json.RawMessage, status int, content string) map[string]any {
	var payload map[string]any
	_ = json.Unmarshal(raw, &payload)
	id, name := h.toolInfo(raw)
	out := map[string]any{
		"id":        id,
		"tool_name": name,
		"status":    status,
		"content":   strings.TrimSpace(content),
	}
	if message := strings.TrimSpace(stringValue(payload["message"])); message != "" {
		out["content"] = message
	}
	if args, ok := firstPresent(payload, "arguments", "args", "input"); ok {
		out["arguments"] = args
		out["arguments_text"] = jsonSummary(args, 800)
	}
	if result, ok := firstPresent(payload, "result", "output"); ok {
		out["result"] = result
		out["result_text"] = jsonSummary(result, 1600)
	}
	return out
}

func firstPresent(values map[string]any, keys ...string) (any, bool) {
	for _, key := range keys {
		if value, ok := values[key]; ok && value != nil {
			return value, true
		}
	}
	return nil, false
}

func jsonSummary(value any, maxRunes int) string {
	if text := strings.TrimSpace(stringValue(value)); text != "" {
		return truncateRunes(text, maxRunes)
	}
	raw, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return truncateRunes(fmt.Sprint(value), maxRunes)
	}
	return truncateRunes(string(raw), maxRunes)
}

func truncateRunes(value string, maxRunes int) string {
	if maxRunes <= 0 {
		return ""
	}
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= maxRunes {
		return string(runes)
	}
	return string(runes[:maxRunes]) + "\n..."
}

func (h *HermesAgentService) eventErrorMessage(raw json.RawMessage) string {
	var payload map[string]any
	_ = json.Unmarshal(raw, &payload)
	for _, key := range []string{"message", "error", "text"} {
		if value := strings.TrimSpace(stringValue(payload[key])); value != "" {
			return value
		}
	}
	return ""
}

func (h *HermesAgentService) toolResultError(raw json.RawMessage) string {
	var payload map[string]any
	_ = json.Unmarshal(raw, &payload)
	result, ok := payload["result"].(map[string]any)
	if !ok {
		if text := strings.TrimSpace(stringValue(payload["result"])); text != "" {
			var decoded map[string]any
			if json.Unmarshal([]byte(text), &decoded) == nil {
				result = decoded
				ok = true
			}
		}
	}
	if !ok {
		return ""
	}

	if value, exists := result["ok"].(bool); exists && value {
		return ""
	}
	if value, exists := result["ok"].(bool); exists && !value {
		if text := strings.TrimSpace(stringValue(result["error"])); text != "" {
			return text
		}
		if meta, ok := result["meta"].(map[string]any); ok {
			if text := strings.TrimSpace(stringValue(meta["message"])); text != "" {
				return text
			}
		}
		return "Tool returned an error"
	}

	if text := strings.TrimSpace(stringValue(result["error"])); text != "" {
		return text
	}
	return ""
}

func (h *HermesAgentService) emitQukaEvent(eventType int, sessionID string, messageID string, spaceID string, sequence int, message string, startAt int, toolTips map[string]any) {
	if h.ctx == nil {
		hermesLogf("skip emit quka event; missing context type=%d session=%q messageID=%q", eventType, sessionID, messageID)
		return
	}
	payload := map[string]any{
		"type": eventType,
		"data": map[string]any{
			"message_id": messageID,
			"session_id": sessionID,
			"message":    message,
			"start_at":   startAt,
			"complete":   0,
			"msg_type":   1,
			"sequence":   sequence,
			"space_id":   spaceID,
		},
	}
	if toolTips != nil {
		data := payload["data"].(map[string]any)
		data["tool_tips"] = toolTips
		data["msg_type"] = 2
	}
	hermesLogf("emit quka event type=%d session=%q messageID=%q messageLen=%d startAt=%d sequence=%d", eventType, sessionID, messageID, runeLen(message), startAt, sequence)
	wailsruntime.EventsEmit(h.ctx, hermesEventName, payload)
}

func writeQukaSkillConfig(req HermesConfigureRequest) error {
	path, err := qukaSkillConfigPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}

	apiBaseURL := normalizeQukaAPIBaseURL(req.APIBaseURL)
	if apiBaseURL == "" {
		apiBaseURL = normalizeQukaAPIBaseURL(req.Host)
	}
	tokenType := normalizeQukaTokenType(req)
	token := qukaTokenValue(req)
	payload := map[string]any{
		"api_base_url": apiBaseURL,
		"host":         apiBaseURL,
		"token_type":   tokenType,
		"space_id":     strings.TrimSpace(req.SpaceID),
		"resource":     strings.TrimSpace(req.Resource),
		"updated_at":   time.Now().Unix(),
	}
	if tokenType == "access" {
		payload["access_token"] = token
	} else {
		payload["auth_token"] = token
	}
	raw, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, raw, 0600)
}

func writeHermesProviderConfig(req HermesProviderConfigureRequest) error {
	path, err := hermesConfigPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}

	config := map[string]any{}
	if raw, err := os.ReadFile(path); err == nil && len(strings.TrimSpace(string(raw))) > 0 {
		if err := yaml.Unmarshal(raw, &config); err != nil {
			return fmt.Errorf("failed to read Hermes config.yaml: %w", err)
		}
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	model := mapValue(config["model"])
	model["default"] = req.ModelName
	model["provider"] = "custom"
	model["base_url"] = strings.TrimRight(req.BaseURL, "/")
	model["api_mode"] = "chat_completions"
	if req.APIKey != "" {
		model["api_key"] = req.APIKey
	}
	config["model"] = model

	web := mapValue(config["web"])
	tavilyConfigured := req.TavilyAPIKey != ""
	if !tavilyConfigured {
		stored, err := hermesProviderStoredConfig()
		if err != nil {
			return err
		}
		tavilyConfigured = stored.TavilyConfigured
	}
	if tavilyConfigured {
		web["backend"] = "tavily"
	}
	config["web"] = web

	raw, err := yaml.Marshal(config)
	if err != nil {
		return err
	}
	return os.WriteFile(path, raw, 0600)
}

func migrateHermesProviderConfig() error {
	configPath, err := hermesConfigPath()
	if err != nil {
		return err
	}
	raw, err := os.ReadFile(configPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	if len(strings.TrimSpace(string(raw))) == 0 {
		return nil
	}

	config := map[string]any{}
	if err := yaml.Unmarshal(raw, &config); err != nil {
		return fmt.Errorf("failed to read Hermes config.yaml: %w", err)
	}
	model := mapValue(config["model"])
	if strings.TrimSpace(stringValue(model["default"])) == "" || strings.TrimSpace(stringValue(model["base_url"])) == "" {
		return nil
	}

	changed := false
	if strings.TrimSpace(stringValue(model["api_mode"])) == "" {
		model["api_mode"] = "chat_completions"
		changed = true
	}
	if strings.TrimSpace(stringValue(model["api_key"])) == "" {
		key, err := hermesEnvAPIKey()
		if err != nil {
			return err
		}
		if key != "" {
			model["api_key"] = key
			changed = true
		}
	}
	web := mapValue(config["web"])
	if strings.TrimSpace(stringValue(web["backend"])) == "" {
		key, err := hermesEnvValue("TAVILY_API_KEY")
		if err != nil {
			return err
		}
		if key != "" {
			web["backend"] = "tavily"
			changed = true
		}
	}
	if !changed {
		return nil
	}

	config["model"] = model
	config["web"] = web
	next, err := yaml.Marshal(config)
	if err != nil {
		return err
	}
	if err := os.WriteFile(configPath, next, 0600); err != nil {
		return err
	}
	hermesLogf("provider config migrated for embedded bridge apiMode=%q apiKeyPresent=%t", stringValue(model["api_mode"]), strings.TrimSpace(stringValue(model["api_key"])) != "")
	return nil
}

func writeHermesEnv(req HermesProviderConfigureRequest) error {
	updates := map[string]string{}
	if req.APIKey != "" {
		updates["OPENAI_API_KEY"] = req.APIKey
	}
	if req.TavilyAPIKey != "" {
		updates["TAVILY_API_KEY"] = req.TavilyAPIKey
	}
	return writeHermesEnvValues(updates)
}

func writeHermesEnvValues(updates map[string]string) error {
	path, err := hermesEnvPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}

	lines := []string{}
	if raw, err := os.ReadFile(path); err == nil {
		lines = splitEnvLines(string(raw))
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}

	if len(updates) == 0 {
		return nil
	}
	seen := map[string]bool{}
	for idx, line := range lines {
		key := envLineKey(line)
		if value, ok := updates[key]; ok {
			lines[idx] = dotenvAssignment(key, value)
			seen[key] = true
		}
	}
	for key, value := range updates {
		if !seen[key] {
			lines = append(lines, dotenvAssignment(key, value))
		}
	}

	raw := strings.Join(lines, "\n")
	if raw != "" {
		raw += "\n"
	}
	return os.WriteFile(path, []byte(raw), 0600)
}

func hermesUserEnvironmentVariables() ([]HermesEnvironmentVariable, error) {
	path, err := hermesEnvPath()
	if err != nil {
		return nil, err
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []HermesEnvironmentVariable{}, nil
		}
		return nil, err
	}

	out := []HermesEnvironmentVariable{}
	for _, line := range splitEnvLines(string(raw)) {
		key := envLineKey(line)
		if key == "" || !isAllowedHermesUserEnvKey(key) {
			continue
		}
		out = append(out, HermesEnvironmentVariable{Name: key, Configured: envLineValue(line) != ""})
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Name < out[j].Name
	})
	return out, nil
}

func writeHermesUserEnvironment(variables []HermesEnvironmentVariable) (map[string]string, []string, error) {
	path, err := hermesEnvPath()
	if err != nil {
		return nil, nil, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, nil, err
	}

	lines := []string{}
	if raw, err := os.ReadFile(path); err == nil {
		lines = splitEnvLines(string(raw))
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, nil, err
	}

	existingUserValues := map[string]string{}
	for _, line := range lines {
		key := envLineKey(line)
		if key != "" && isAllowedHermesUserEnvKey(key) {
			existingUserValues[key] = envLineValue(line)
		}
	}

	updates := map[string]string{}
	desiredKeys := map[string]bool{}
	for _, item := range variables {
		key := strings.TrimSpace(item.Name)
		if key == "" && strings.TrimSpace(item.Value) == "" {
			continue
		}
		if !isAllowedHermesUserEnvKey(key) {
			return nil, nil, fmt.Errorf("environment variable %q is not allowed", key)
		}
		desiredKeys[key] = true
		value := item.Value
		if strings.TrimSpace(value) == "" {
			if existing, ok := existingUserValues[key]; ok {
				value = existing
			}
		}
		updates[key] = value
	}

	removals := []string{}
	for key := range existingUserValues {
		if !desiredKeys[key] {
			removals = append(removals, key)
		}
	}
	sort.Strings(removals)

	nextLines := make([]string, 0, len(lines)+len(updates))
	seen := map[string]bool{}
	for _, line := range lines {
		key := envLineKey(line)
		if key == "" {
			nextLines = append(nextLines, line)
			continue
		}
		if _, remove := existingUserValues[key]; remove && !desiredKeys[key] {
			continue
		}
		if value, ok := updates[key]; ok {
			nextLines = append(nextLines, dotenvAssignment(key, value))
			seen[key] = true
			continue
		}
		nextLines = append(nextLines, line)
	}
	keys := make([]string, 0, len(updates))
	for key := range updates {
		if !seen[key] {
			keys = append(keys, key)
		}
	}
	sort.Strings(keys)
	for _, key := range keys {
		nextLines = append(nextLines, dotenvAssignment(key, updates[key]))
	}

	raw := strings.Join(nextLines, "\n")
	if raw != "" {
		raw += "\n"
	}
	if err := os.WriteFile(path, []byte(raw), 0600); err != nil {
		return nil, nil, err
	}
	return updates, removals, nil
}

func isAllowedHermesUserEnvKey(key string) bool {
	if envLineKey(key+"=") != key {
		return false
	}
	switch key {
	case "HOME", "USERPROFILE", "PATH", "HERMES_HOME", "QUKA_HERMES_HOME", "HERMES_KANBAN_HOME",
		"HERMES_PLATFORM", "HERMES_SESSION_PLATFORM", "HERMES_DASHBOARD_SESSION_TOKEN",
		"HERMES_BUNDLED_PLUGINS", "PYINSTALLER_RESET_ENVIRONMENT", "QUKA_AI_CONFIG",
		"OPENAI_API_KEY", "TAVILY_API_KEY":
		return false
	}
	for _, prefix := range []string{"QUKA_", "_PYI_", "PYINSTALLER_"} {
		if strings.HasPrefix(key, prefix) {
			return false
		}
	}
	return true
}

func hermesEnvAPIKey() (string, error) {
	return hermesEnvValue("OPENAI_API_KEY")
}

func hermesEnvValue(name string) (string, error) {
	path, err := hermesEnvPath()
	if err != nil {
		return "", err
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", nil
		}
		return "", err
	}
	for _, line := range splitEnvLines(string(raw)) {
		if envLineKey(line) == name {
			return strings.TrimSpace(envLineValue(line)), nil
		}
	}
	return "", nil
}

func hermesProviderStoredConfig() (HermesProviderStoredConfig, error) {
	configPath, err := hermesConfigPath()
	if err != nil {
		return HermesProviderStoredConfig{}, err
	}
	envPath, err := hermesEnvPath()
	if err != nil {
		return HermesProviderStoredConfig{}, err
	}

	out := HermesProviderStoredConfig{}
	if raw, err := os.ReadFile(configPath); err == nil && len(strings.TrimSpace(string(raw))) > 0 {
		config := map[string]any{}
		if err := yaml.Unmarshal(raw, &config); err != nil {
			return out, fmt.Errorf("failed to read Hermes config.yaml: %w", err)
		}
		model := mapValue(config["model"])
		out.ModelName = strings.TrimSpace(stringValue(model["default"]))
		out.BaseURL = strings.TrimSpace(stringValue(model["base_url"]))
		out.APIKeyConfigured = strings.TrimSpace(stringValue(model["api_key"])) != ""
		web := mapValue(config["web"])
		out.TavilyConfigured = strings.TrimSpace(stringValue(web["backend"])) == "tavily"
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return out, err
	}

	if raw, err := os.ReadFile(envPath); err == nil {
		for _, line := range splitEnvLines(string(raw)) {
			switch envLineKey(line) {
			case "OPENAI_API_KEY":
				if envLineValue(line) != "" {
					out.APIKeyConfigured = true
				}
			case "TAVILY_API_KEY":
				if envLineValue(line) != "" {
					out.TavilyConfigured = true
				}
			}
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return out, err
	}

	return out, nil
}

func hermesProviderRuntimeConfigFromDisk(req HermesProviderConfigureRequest) (hermesProviderRuntimeConfig, error) {
	configPath, err := hermesConfigPath()
	if err != nil {
		return hermesProviderRuntimeConfig{}, err
	}
	out := hermesProviderRuntimeConfig{
		ModelName: strings.TrimSpace(req.ModelName),
		Provider:  "custom",
		BaseURL:   strings.TrimRight(strings.TrimSpace(req.BaseURL), "/"),
		APIKey:    strings.TrimSpace(req.APIKey),
		APIMode:   "chat_completions",
	}

	if raw, err := os.ReadFile(configPath); err == nil && len(strings.TrimSpace(string(raw))) > 0 {
		config := map[string]any{}
		if err := yaml.Unmarshal(raw, &config); err != nil {
			return out, fmt.Errorf("failed to read Hermes config.yaml: %w", err)
		}
		model := mapValue(config["model"])
		if value := strings.TrimSpace(stringValue(model["default"])); value != "" {
			out.ModelName = value
		}
		if value := strings.TrimSpace(stringValue(model["provider"])); value != "" {
			out.Provider = value
		}
		if value := strings.TrimRight(strings.TrimSpace(stringValue(model["base_url"])), "/"); value != "" {
			out.BaseURL = value
		}
		if value := strings.TrimSpace(stringValue(model["api_key"])); value != "" {
			out.APIKey = value
		}
		if value := strings.TrimSpace(stringValue(model["api_mode"])); value != "" {
			out.APIMode = value
		}
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return out, err
	}

	if out.APIKey == "" {
		key, err := hermesEnvAPIKey()
		if err != nil {
			return out, err
		}
		out.APIKey = strings.TrimSpace(key)
	}
	return out, nil
}

func mapValue(value any) map[string]any {
	out, ok := value.(map[string]any)
	if ok {
		return out
	}
	return map[string]any{}
}

func stringSliceValue(value any) []string {
	switch x := value.(type) {
	case []string:
		return append([]string{}, x...)
	case []any:
		out := make([]string, 0, len(x))
		for _, item := range x {
			text := strings.TrimSpace(stringValue(item))
			if text != "" {
				out = append(out, text)
			}
		}
		return out
	case nil:
		return []string{}
	default:
		text := strings.TrimSpace(stringValue(x))
		if text == "" {
			return []string{}
		}
		return []string{text}
	}
}

func stringSliceContains(values []string, target string) bool {
	for _, value := range values {
		if strings.TrimSpace(value) == target {
			return true
		}
	}
	return false
}

func splitEnvLines(raw string) []string {
	raw = strings.ReplaceAll(raw, "\r\n", "\n")
	raw = strings.TrimSuffix(raw, "\n")
	if raw == "" {
		return []string{}
	}
	return strings.Split(raw, "\n")
}

func envLineKey(line string) string {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" || strings.HasPrefix(trimmed, "#") {
		return ""
	}
	key, _, ok := strings.Cut(trimmed, "=")
	if !ok {
		return ""
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return ""
	}
	for idx, r := range key {
		if idx == 0 {
			if !(r == '_' || r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z') {
				return ""
			}
			continue
		}
		if !(r == '_' || r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' || r >= '0' && r <= '9') {
			return ""
		}
	}
	return key
}

func envLineValue(line string) string {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" || strings.HasPrefix(trimmed, "#") {
		return ""
	}
	_, value, ok := strings.Cut(trimmed, "=")
	if !ok {
		return ""
	}
	value = strings.TrimSpace(value)
	if unquoted, err := strconv.Unquote(value); err == nil {
		return strings.TrimSpace(unquoted)
	}
	return strings.Trim(value, `"'`)
}

func dotenvAssignment(key string, value string) string {
	return key + "=" + strconv.Quote(value)
}

func ensureHermesBundledSkillsConfigured() error {
	skillsDir, err := resolveHermesBundledSkillsDir()
	if err != nil {
		return err
	}

	configPath, err := hermesConfigPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(configPath), 0700); err != nil {
		return err
	}

	config := map[string]any{}
	if raw, err := os.ReadFile(configPath); err == nil && len(strings.TrimSpace(string(raw))) > 0 {
		if err := yaml.Unmarshal(raw, &config); err != nil {
			return fmt.Errorf("failed to read Hermes config.yaml: %w", err)
		}
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	skills := mapValue(config["skills"])
	externalDirs := stringSliceValue(skills["external_dirs"])
	if stringSliceContains(externalDirs, skillsDir) {
		return nil
	}
	externalDirs = append(externalDirs, skillsDir)
	skills["external_dirs"] = externalDirs
	config["skills"] = skills

	raw, err := yaml.Marshal(config)
	if err != nil {
		return err
	}
	if err := os.WriteFile(configPath, raw, 0600); err != nil {
		return err
	}
	hermesLogf("bundled Hermes skills configured dir=%q", skillsDir)
	return nil
}

func hermesSkills() (*HermesSkillList, error) {
	home, err := hermesHomeDir()
	if err != nil {
		return nil, err
	}
	userRoot := filepath.Join(home, "skills")
	builtInRoot, _ := resolveHermesBundledSkillsDir()

	items := []HermesSkillInfo{}
	if userSkills, err := scanHermesSkillsRoot(userRoot, "user", false); err == nil {
		items = append(items, userSkills...)
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	if builtInRoot != "" {
		if builtInSkills, err := scanHermesSkillsRoot(builtInRoot, "built-in", true); err == nil {
			items = append(items, builtInSkills...)
		} else if !errors.Is(err, os.ErrNotExist) {
			return nil, err
		}
	}
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].BuiltIn != items[j].BuiltIn {
			return !items[i].BuiltIn
		}
		return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
	})
	return &HermesSkillList{Skills: items, UserSkillsDir: userRoot, BuiltInRootDir: builtInRoot}, nil
}

func hermesSkillContent(req HermesSkillViewRequest) (*HermesSkillContent, error) {
	req.Name = strings.TrimSpace(req.Name)
	req.Source = strings.TrimSpace(req.Source)
	if req.Name == "" {
		return nil, errors.New("skill name is required")
	}
	list, err := hermesSkills()
	if err != nil {
		return nil, err
	}
	for _, item := range list.Skills {
		if item.Name != req.Name {
			continue
		}
		if req.Source != "" && item.Source != req.Source {
			continue
		}
		content, err := os.ReadFile(filepath.Join(item.Path, "SKILL.md"))
		if err != nil {
			return nil, err
		}
		return &HermesSkillContent{Info: item, Content: string(content)}, nil
	}
	return nil, fmt.Errorf("Hermes skill not found: %s", req.Name)
}

func hermesInstallSkill(req HermesSkillInstallRequest) error {
	source := strings.TrimSpace(req.SourcePath)
	if source == "" {
		return errors.New("skill source path is required")
	}
	source, err := filepath.Abs(source)
	if err != nil {
		return err
	}
	info, err := os.Stat(source)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("skill source path is not a directory: %s", source)
	}

	skillPath := filepath.Join(source, "SKILL.md")
	content, err := os.ReadFile(skillPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("skill source must contain SKILL.md: %s", source)
		}
		return err
	}

	name, _ := parseHermesSkillFrontmatter(string(content), filepath.Base(source))
	name = strings.TrimSpace(name)
	if name == "" {
		return errors.New("skill name is required")
	}
	if isReservedHermesSkillName(name) {
		return fmt.Errorf("cannot install over bundled Hermes skill: %s", name)
	}
	destName := safeHermesSkillDirectoryName(name)
	if destName == "" {
		destName = safeHermesSkillDirectoryName(filepath.Base(source))
	}
	if destName == "" {
		return fmt.Errorf("invalid skill name: %s", name)
	}

	home, err := hermesHomeDir()
	if err != nil {
		return err
	}
	userRoot := filepath.Join(home, "skills")
	if err := os.MkdirAll(userRoot, 0700); err != nil {
		return err
	}

	dest := filepath.Join(userRoot, destName)
	if source == dest {
		return fmt.Errorf("skill is already installed: %s", source)
	}
	tmp, err := os.MkdirTemp(userRoot, "."+destName+"-install-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmp)

	if err := copyHermesSkillDir(source, tmp); err != nil {
		return err
	}
	if err := os.RemoveAll(dest); err != nil {
		return err
	}
	if err := os.Rename(tmp, dest); err != nil {
		return err
	}
	hermesLogf("Hermes skill installed name=%q source=%q dest=%q", name, source, dest)
	return nil
}

func hermesDeleteSkill(req HermesSkillDeleteRequest) error {
	req.Name = strings.TrimSpace(req.Name)
	req.Source = strings.TrimSpace(req.Source)
	req.Path = strings.TrimSpace(req.Path)
	if req.Name == "" && req.Path == "" {
		return errors.New("skill name or path is required")
	}

	list, err := hermesSkills()
	if err != nil {
		return err
	}
	var matched *HermesSkillInfo
	for i := range list.Skills {
		item := list.Skills[i]
		if req.Path != "" && filepath.Clean(item.Path) != filepath.Clean(req.Path) {
			continue
		}
		if req.Name != "" && item.Name != req.Name {
			continue
		}
		if req.Source != "" && item.Source != req.Source {
			continue
		}
		matched = &item
		break
	}
	if matched == nil {
		return fmt.Errorf("Hermes skill not found: %s", req.Name)
	}
	if matched.BuiltIn || matched.Source == "built-in" {
		return fmt.Errorf("cannot delete bundled Hermes skill: %s", matched.Name)
	}

	userRoot := list.UserSkillsDir
	if userRoot == "" {
		home, err := hermesHomeDir()
		if err != nil {
			return err
		}
		userRoot = filepath.Join(home, "skills")
	}
	if err := ensurePathWithinRoot(matched.Path, userRoot); err != nil {
		return err
	}
	if !hasSkillFile(matched.Path) {
		return fmt.Errorf("Hermes skill directory is invalid: %s", matched.Path)
	}
	if err := os.RemoveAll(matched.Path); err != nil {
		return err
	}
	hermesLogf("Hermes skill deleted name=%q path=%q", matched.Name, matched.Path)
	return nil
}

func scanHermesSkillsRoot(root string, source string, builtIn bool) ([]HermesSkillInfo, error) {
	root = strings.TrimSpace(root)
	if root == "" {
		return []HermesSkillInfo{}, nil
	}
	info, err := os.Stat(root)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("Hermes skills root is not a directory: %s", root)
	}

	items := []HermesSkillInfo{}
	err = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			if isExcludedHermesSkillPath(path) && path != root {
				return filepath.SkipDir
			}
			return nil
		}
		if info.Name() != "SKILL.md" {
			return nil
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		skillDir := filepath.Dir(path)
		name, description := parseHermesSkillFrontmatter(string(content), filepath.Base(skillDir))
		items = append(items, HermesSkillInfo{
			Name:        name,
			Description: description,
			Source:      source,
			Path:        skillDir,
			BuiltIn:     builtIn,
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	return items, nil
}

func isExcludedHermesSkillPath(path string) bool {
	switch filepath.Base(path) {
	case ".git", ".github", ".hub", ".archive", ".venv", "venv", "node_modules", "site-packages", "__pycache__", ".tox", ".nox", ".pytest_cache", ".mypy_cache", ".ruff_cache":
		return true
	default:
		return false
	}
}

func isReservedHermesSkillName(name string) bool {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "quka-ai", "quka-journal":
		return true
	default:
		return false
	}
}

func safeHermesSkillDirectoryName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" || name == "." || name == ".." {
		return ""
	}
	var b strings.Builder
	for _, r := range strings.ToLower(name) {
		switch {
		case r >= 'a' && r <= 'z':
			b.WriteRune(r)
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '-' || r == '_' || r == '.':
			b.WriteRune(r)
		case r == ' ':
			b.WriteRune('-')
		}
	}
	out := strings.Trim(b.String(), ".-_")
	if out == "" || out == "." || out == ".." || strings.Contains(out, string(os.PathSeparator)) {
		return ""
	}
	return out
}

func copyHermesSkillDir(source string, dest string) error {
	sourceInfo, err := os.Stat(source)
	if err != nil {
		return err
	}
	if !sourceInfo.IsDir() {
		return fmt.Errorf("source is not a directory: %s", source)
	}
	if err := os.MkdirAll(dest, sourceInfo.Mode().Perm()); err != nil {
		return err
	}

	entries, err := os.ReadDir(source)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		name := entry.Name()
		srcPath := filepath.Join(source, name)
		dstPath := filepath.Join(dest, name)
		if isExcludedHermesSkillPath(srcPath) {
			if entry.IsDir() {
				continue
			}
			continue
		}

		entryInfo, err := entry.Info()
		if err != nil {
			return err
		}
		if entryInfo.Mode()&os.ModeSymlink != 0 {
			continue
		}
		if entry.IsDir() {
			if err := copyHermesSkillDir(srcPath, dstPath); err != nil {
				return err
			}
			continue
		}
		if entryInfo.Mode()&os.ModeType != 0 {
			continue
		}
		mode := entryInfo.Mode().Perm()
		if strings.HasSuffix(name, ".py") || strings.HasSuffix(name, ".sh") {
			mode |= 0700
		}
		raw, err := os.ReadFile(srcPath)
		if err != nil {
			return err
		}
		if err := os.WriteFile(dstPath, raw, mode); err != nil {
			return err
		}
	}
	return nil
}

func ensurePathWithinRoot(path string, root string) error {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return err
	}
	rel, err := filepath.Rel(absRoot, absPath)
	if err != nil {
		return err
	}
	if rel == "." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) || rel == ".." || filepath.IsAbs(rel) {
		return fmt.Errorf("Hermes skill path is outside user skills directory: %s", path)
	}
	return nil
}

func parseHermesSkillFrontmatter(content string, fallbackName string) (string, string) {
	name := fallbackName
	description := ""
	trimmed := strings.TrimSpace(content)
	if !strings.HasPrefix(trimmed, "---") {
		return name, firstNonEmptySkillLine(content)
	}
	rest := strings.TrimPrefix(trimmed, "---")
	end := strings.Index(rest, "\n---")
	if end < 0 {
		return name, firstNonEmptySkillLine(content)
	}
	for _, line := range strings.Split(rest[:end], "\n") {
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		clean := strings.Trim(strings.TrimSpace(value), `"'`)
		switch strings.TrimSpace(key) {
		case "name":
			if clean != "" {
				name = clean
			}
		case "description":
			description = clean
		}
	}
	if description == "" {
		description = firstNonEmptySkillLine(rest[end+len("\n---"):])
	}
	return name, description
}

func firstNonEmptySkillLine(content string) string {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "---") {
			continue
		}
		if len([]rune(line)) > 180 {
			line = string([]rune(line)[:180]) + "..."
		}
		return line
	}
	return ""
}

func ensureQukaMemoryProviderInstalled() error {
	source, err := resolveQukaMemoryProviderSource()
	if err != nil {
		return err
	}
	home, err := hermesHomeDir()
	if err != nil {
		return err
	}
	dest := filepath.Join(home, "plugins", "qukaai")
	if err := os.RemoveAll(dest); err != nil {
		return err
	}
	if err := copyDir(source, dest); err != nil {
		return err
	}
	hermesLogf("quka memory provider installed source=%q dest=%q", source, dest)
	return nil
}

func resolveQukaMemoryProviderSource() (string, error) {
	candidates := []string{}
	if value := strings.TrimSpace(os.Getenv("QUKA_HERMES_MEMORY_PLUGIN_SOURCE")); value != "" {
		candidates = append(candidates, value)
	}
	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(cwd, "hermes-runtime", "plugins", "qukaai"),
			filepath.Join(cwd, "build", "hermes-runtime-build", "plugins", "qukaai"),
			filepath.Join(cwd, "hermes-agent", "plugins", "qukaai"),
			filepath.Join(cwd, "build", "hermes-agent", "plugins", "qukaai"),
		)
	}
	if bridge, err := resolveHermesBridgeExecutable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(bridge), "plugins", "qukaai"))
	}
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		candidates = append(candidates, filepath.Join(exeDir, "hermes-agent", "plugins", "qukaai"))
		if filepath.Base(exeDir) == "MacOS" && filepath.Base(filepath.Dir(exeDir)) == "Contents" {
			candidates = append(candidates, filepath.Join(filepath.Dir(exeDir), "Resources", "hermes-agent", "plugins", "qukaai"))
		}
	}

	for _, candidate := range candidates {
		if isQukaMemoryProviderDir(candidate) {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("QukaAI Hermes memory provider plugin not found; expected plugin.yaml and __init__.py in one of: %s", strings.Join(candidates, ", "))
}

func isQukaMemoryProviderDir(path string) bool {
	info, err := os.Stat(path)
	if err != nil || !info.IsDir() {
		return false
	}
	if _, err := os.Stat(filepath.Join(path, "plugin.yaml")); err != nil {
		return false
	}
	if _, err := os.Stat(filepath.Join(path, "__init__.py")); err != nil {
		return false
	}
	return true
}

func copyDir(source string, dest string) error {
	info, err := os.Stat(source)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("source is not a directory: %s", source)
	}
	if err := os.MkdirAll(dest, info.Mode().Perm()); err != nil {
		return err
	}
	entries, err := os.ReadDir(source)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		name := entry.Name()
		if name == "__pycache__" || name == "tests" || strings.HasSuffix(name, ".pyc") {
			continue
		}
		srcPath := filepath.Join(source, name)
		dstPath := filepath.Join(dest, name)
		if entry.IsDir() {
			if err := copyDir(srcPath, dstPath); err != nil {
				return err
			}
			continue
		}
		entryInfo, err := entry.Info()
		if err != nil {
			return err
		}
		if entryInfo.Mode()&os.ModeType != 0 {
			continue
		}
		raw, err := os.ReadFile(srcPath)
		if err != nil {
			return err
		}
		if err := os.WriteFile(dstPath, raw, entryInfo.Mode().Perm()); err != nil {
			return err
		}
	}
	return nil
}

func writeQukaMemoryProviderConfig(req HermesConfigureRequest) error {
	home, err := hermesHomeDir()
	if err != nil {
		return err
	}

	apiBaseURL := normalizeQukaAPIBaseURL(req.APIBaseURL)
	if apiBaseURL == "" {
		apiBaseURL = normalizeQukaAPIBaseURL(req.Host)
	}
	tokenType := normalizeQukaTokenType(req)
	token := qukaTokenValue(req)
	spaceID := strings.TrimSpace(req.SpaceID)
	if apiBaseURL == "" || token == "" || spaceID == "" {
		return errors.New("quka memory provider requires api base url, auth token, and space id")
	}

	configPath := filepath.Join(home, "qukaai-memory.json")
	if err := os.MkdirAll(filepath.Dir(configPath), 0700); err != nil {
		return err
	}
	payload := map[string]any{
		"api_base_url":           apiBaseURL,
		"space_id":               spaceID,
		"default_layer":          "user_space",
		"hydrate_token_budget":   1200,
		"prefetch_limit":         6,
		"sync_turn":              "off",
		"reflect_on_session_end": true,
		"mirror_builtin_memory":  true,
		"agent_identity":         "quka-desktop",
		"agent_workspace":        strings.TrimSpace(req.Resource),
		"platform":               "desktop",
		"updated_at":             time.Now().Unix(),
	}
	if payload["agent_workspace"] == "" {
		payload["agent_workspace"] = "knowledge"
	}
	raw, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(configPath, raw, 0600); err != nil {
		return err
	}

	envUpdates := map[string]string{
		"QUKA_API_BASE_URL": apiBaseURL,
		"QUKA_SPACE_ID":     spaceID,
	}
	if tokenType == "access" {
		envUpdates["QUKA_ACCESS_TOKEN"] = token
		envUpdates["QUKA_AUTH_TOKEN"] = ""
	} else {
		envUpdates["QUKA_ACCESS_TOKEN"] = ""
		envUpdates["QUKA_AUTH_TOKEN"] = token
	}
	if err := writeHermesEnvValues(envUpdates); err != nil {
		return err
	}
	hermesLogf("quka memory provider config saved space=%q apiBaseURL=%q", spaceID, apiBaseURL)
	return nil
}

func enableQukaMemoryProvider() error {
	path, err := hermesConfigPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}

	config := map[string]any{}
	if raw, err := os.ReadFile(path); err == nil && len(strings.TrimSpace(string(raw))) > 0 {
		if err := yaml.Unmarshal(raw, &config); err != nil {
			return fmt.Errorf("failed to read Hermes config.yaml: %w", err)
		}
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	memory := mapValue(config["memory"])
	changed := false
	if strings.TrimSpace(stringValue(memory["provider"])) != "qukaai" {
		memory["provider"] = "qukaai"
		config["memory"] = memory
		changed = true
	}
	plugins := mapValue(config["plugins"])
	enabled := stringSliceValue(plugins["enabled"])
	if !stringSliceContains(enabled, "qukaai") {
		enabled = append(enabled, "qukaai")
		plugins["enabled"] = enabled
		config["plugins"] = plugins
		changed = true
	}
	if !changed {
		return nil
	}
	raw, err := yaml.Marshal(config)
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, raw, 0600); err != nil {
		return err
	}
	hermesLogf("quka memory provider and plugin enabled in config.yaml")
	return nil
}

func qukaMemoryProviderConfigured() (bool, error) {
	home, err := hermesHomeDir()
	if err != nil {
		return false, err
	}
	configured := map[string]string{}
	if raw, err := os.ReadFile(filepath.Join(home, "qukaai-memory.json")); err == nil {
		var data map[string]any
		if err := json.Unmarshal(raw, &data); err != nil {
			return false, err
		}
		configured["api_base_url"] = strings.TrimSpace(stringValue(data["api_base_url"]))
		configured["space_id"] = strings.TrimSpace(stringValue(data["space_id"]))
	} else if !errors.Is(err, os.ErrNotExist) {
		return false, err
	}
	for _, name := range []string{"QUKA_API_BASE_URL", "QUKA_SPACE_ID", "QUKA_ACCESS_TOKEN", "QUKA_AUTH_TOKEN"} {
		value, err := hermesEnvValue(name)
		if err != nil {
			return false, err
		}
		if strings.TrimSpace(value) != "" {
			configured[name] = strings.TrimSpace(value)
		}
	}
	apiBaseURL := configured["api_base_url"]
	if apiBaseURL == "" {
		apiBaseURL = configured["QUKA_API_BASE_URL"]
	}
	spaceID := configured["space_id"]
	if spaceID == "" {
		spaceID = configured["QUKA_SPACE_ID"]
	}
	token := configured["QUKA_ACCESS_TOKEN"]
	if token == "" {
		token = configured["QUKA_AUTH_TOKEN"]
	}
	return apiBaseURL != "" && spaceID != "" && token != "", nil
}

func qukaSkillConfigPath() (string, error) {
	home, err := hermesHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "quka-ai", "config.json"), nil
}

func hermesConfigPath() (string, error) {
	home, err := hermesHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "config.yaml"), nil
}

func hermesEnvPath() (string, error) {
	home, err := hermesHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".env"), nil
}

func hermesDesktopStorePath() (string, error) {
	home, err := hermesHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "quka-ai", "desktop-sessions.json"), nil
}

func maxHermesMessageSequence(history []HermesMessageDetail) int {
	maxSeq := 0
	for _, item := range history {
		if item.Meta.Sequence > maxSeq {
			maxSeq = item.Meta.Sequence
		}
	}
	return maxSeq
}

func hermesAgentHistoryFromQukaMessages(history []HermesMessageDetail) []map[string]any {
	out := make([]map[string]any, 0, len(history))
	for _, item := range history {
		role := ""
		switch item.Meta.Role {
		case 1:
			role = "user"
		case 2:
			role = "assistant"
		default:
			continue
		}
		text := strings.TrimSpace(stringValue(item.Meta.Message["provider_text"]))
		if text == "" {
			text = strings.TrimSpace(stringValue(item.Meta.Message["text"]))
		}
		if text == "" {
			continue
		}
		out = append(out, map[string]any{
			"role":    role,
			"content": text,
		})
	}
	return out
}

func hermesProviderConfiguredDetails() (bool, hermesProviderDetails, error) {
	configPath, err := hermesConfigPath()
	if err != nil {
		return false, hermesProviderDetails{}, err
	}
	envPath, err := hermesEnvPath()
	if err != nil {
		return false, hermesProviderDetails{}, err
	}

	details := hermesProviderDetails{}
	configRaw, err := os.ReadFile(configPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false, details, nil
		}
		return false, details, err
	}
	if len(strings.TrimSpace(string(configRaw))) == 0 {
		return false, details, nil
	}
	config := map[string]any{}
	if err := yaml.Unmarshal(configRaw, &config); err != nil {
		return false, details, fmt.Errorf("failed to read Hermes config.yaml: %w", err)
	}

	model := mapValue(config["model"])
	details.ModelName = strings.TrimSpace(stringValue(model["default"]))
	details.BaseURL = strings.TrimSpace(stringValue(model["base_url"]))
	details.APIKeyPresent = strings.TrimSpace(stringValue(model["api_key"])) != ""
	if details.BaseURL != "" {
		parsed, err := url.Parse(details.BaseURL)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
			return false, details, nil
		}
	}

	if details.APIKeyPresent {
		return details.ModelName != "" && details.BaseURL != "", details, nil
	}

	envRaw, err := os.ReadFile(envPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false, details, nil
		}
		return false, details, err
	}
	for _, line := range splitEnvLines(string(envRaw)) {
		if envLineKey(line) == "OPENAI_API_KEY" && envLineValue(line) != "" {
			details.APIKeyPresent = true
			break
		}
	}

	return details.ModelName != "" && details.BaseURL != "" && details.APIKeyPresent, details, nil
}

func hermesConfiguredModelName() (string, error) {
	path, err := hermesConfigPath()
	if err != nil {
		return "", err
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", nil
		}
		return "", err
	}
	config := map[string]any{}
	if err := yaml.Unmarshal(raw, &config); err != nil {
		return "", err
	}
	model := mapValue(config["model"])
	return strings.TrimSpace(stringValue(model["default"])), nil
}

func hermesHomeDir() (string, error) {
	if home := strings.TrimSpace(os.Getenv("QUKA_HERMES_HOME")); home != "" {
		return home, nil
	}
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "QukaAI", "hermes"), nil
}

func qukaDesktopTmpDir(hermesHome string) (string, error) {
	tmpDir := qukaDesktopTmpDirForDate(hermesHome, time.Now())
	if err := os.MkdirAll(tmpDir, 0700); err != nil {
		return "", err
	}
	return tmpDir, nil
}

func qukaDesktopTmpDirForDate(hermesHome string, date time.Time) string {
	appDir := filepath.Dir(filepath.Clean(hermesHome))
	return filepath.Join(appDir, "tmp", date.Format("2006-01-02"))
}

func waitForHermesWebSocket(wsURL string, waitCh <-chan error, startupLogs *processLogBuffer) (*websocket.Conn, error) {
	startedAt := time.Now()
	deadline := time.Now().Add(45 * time.Second)
	var lastErr error
	nextLog := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		select {
		case err := <-waitCh:
			details := hermesStartupLogDetails(startupLogs)
			if err != nil {
				return nil, fmt.Errorf("embedded Hermes bridge exited before it became ready: %w%s", err, details)
			}
			return nil, fmt.Errorf("embedded Hermes bridge exited before it became ready%s", details)
		default:
		}
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		if err == nil {
			return conn, nil
		}
		lastErr = err
		if time.Now().After(nextLog) {
			hermesLogf("bridge not accepting websocket yet elapsed=%s wsURL=%q lastErr=%v%s", time.Since(startedAt).Round(time.Millisecond), wsURL, lastErr, hermesStartupLogDetails(startupLogs))
			nextLog = time.Now().Add(5 * time.Second)
		}
		time.Sleep(500 * time.Millisecond)
	}
	details := hermesStartupLogDetails(startupLogs)
	if lastErr != nil {
		return nil, fmt.Errorf("timed out waiting for embedded Hermes bridge: %w%s", lastErr, details)
	}
	return nil, fmt.Errorf("timed out waiting for embedded Hermes bridge%s", details)
}

func hermesStartupLogDetails(startupLogs *processLogBuffer) string {
	if startupLogs == nil {
		return ""
	}
	logs := strings.TrimSpace(startupLogs.String())
	if logs == "" {
		return ""
	}
	const maxLen = 4000
	if len(logs) > maxLen {
		logs = logs[len(logs)-maxLen:]
	}
	return "\nHermes bridge output:\n" + logs
}

func pickPort() (int, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer listener.Close()
	return listener.Addr().(*net.TCPAddr).Port, nil
}

func randomID() string {
	var b [18]byte
	if _, err := rand.Read(b[:]); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return base64.RawURLEncoding.EncodeToString(b[:])
}

func titleFromMessage(message string) string {
	title := strings.TrimSpace(strings.ReplaceAll(message, "\n", " "))
	if len([]rune(title)) > 40 {
		title = string([]rune(title)[:40])
	}
	return title
}

func runeLen(s string) int {
	return len([]rune(s))
}

func stringValue(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case fmt.Stringer:
		return x.String()
	case nil:
		return ""
	default:
		return fmt.Sprintf("%v", x)
	}
}

func hermesRoleToQukaRole(role string) int {
	switch strings.ToLower(role) {
	case "user":
		return 1
	case "assistant":
		return 2
	case "tool":
		return 4
	default:
		return 2
	}
}

func hermesContentText(content any) string {
	switch value := content.(type) {
	case string:
		return value
	case []any:
		parts := make([]string, 0, len(value))
		for _, item := range value {
			if m, ok := item.(map[string]any); ok {
				if text := stringValue(m["text"]); text != "" {
					parts = append(parts, text)
				}
			}
		}
		return strings.Join(parts, "\n")
	default:
		return stringValue(value)
	}
}
