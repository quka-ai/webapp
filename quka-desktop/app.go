package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// App struct
type App struct {
	ctx    context.Context
	hermes *HermesAgentService
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		hermes: NewHermesAgentService(),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.hermes.SetContext(ctx)
	go func() {
		if err := a.hermes.CleanupExpiredDesktopData(); err != nil {
			hermesLogf("app startup: desktop cleanup failed: %v", err)
		}
	}()
	hermesLogf("app startup: checking Hermes provider configuration")
	go a.hermes.StartIfProviderConfigured()
}

func (a *App) shutdown(ctx context.Context) {
	hermesLogf("app shutdown: stopping Hermes bridge")
	a.hermes.Stop()
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

type OpenLocalPathRequest struct {
	URL  string `json:"url"`
	Path string `json:"path"`
}

func (a *App) OpenLocalPath(req OpenLocalPathRequest) error {
	path, err := localPathFromOpenRequest(req)
	if err != nil {
		return err
	}
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("local file does not exist: %s", path)
		}
		return err
	}
	if info.Mode()&os.ModeType != 0 && !info.IsDir() {
		return fmt.Errorf("unsupported local file type: %s", path)
	}
	return openLocalPath(path)
}

func (a *App) ConfigureHermesAgent(req HermesConfigureRequest) (*HermesStatus, error) {
	return a.hermes.Configure(req)
}

func (a *App) ConfigureHermesProvider(req HermesProviderConfigureRequest) (*HermesStatus, error) {
	return a.hermes.ConfigureProvider(req)
}

func (a *App) HasHermesProviderConfigured() bool {
	return a.hermes.HasProviderConfigured()
}

func (a *App) GetHermesProviderConfig() (*HermesProviderStoredConfig, error) {
	return a.hermes.ProviderConfig()
}

func (a *App) GetHermesEnvironmentVariables() ([]HermesEnvironmentVariable, error) {
	return a.hermes.EnvironmentVariables()
}

func (a *App) ConfigureHermesEnvironment(req HermesEnvironmentConfigureRequest) ([]HermesEnvironmentVariable, error) {
	return a.hermes.ConfigureEnvironment(req)
}

func (a *App) ListHermesSkills() (*HermesSkillList, error) {
	return a.hermes.Skills()
}

func (a *App) ViewHermesSkill(req HermesSkillViewRequest) (*HermesSkillContent, error) {
	return a.hermes.ViewSkill(req)
}

func (a *App) ReloadHermesSkills() (*HermesSkillList, error) {
	return a.hermes.ReloadSkills()
}

func (a *App) InstallHermesSkill(req HermesSkillInstallRequest) (*HermesSkillList, error) {
	return a.hermes.InstallSkill(req)
}

func (a *App) DeleteHermesSkill(req HermesSkillDeleteRequest) (*HermesSkillList, error) {
	return a.hermes.DeleteSkill(req)
}

func (a *App) ListHermesAgents() (*HermesAgentProfileList, error) {
	return a.hermes.AgentProfiles()
}

func (a *App) SaveHermesAgent(req HermesAgentProfileSaveRequest) (*HermesAgentProfileList, error) {
	return a.hermes.SaveAgentProfile(req)
}

func (a *App) DeleteHermesAgent(req HermesAgentProfileDeleteRequest) (*HermesAgentProfileList, error) {
	return a.hermes.DeleteAgentProfile(req)
}

func (a *App) RunHermesAgentTest(req HermesAgentRunTestRequest) (*HermesAgentRunTestResult, error) {
	return a.hermes.RunAgentTest(req)
}

func (a *App) ResolveHermesInteraction(req HermesInteractionResolveRequest) error {
	return a.hermes.ResolveInteraction(req)
}

func (a *App) GetHermesAgentStatus() *HermesStatus {
	return a.hermes.Status()
}

func (a *App) GetHermesRuntimeDiagnostics() (map[string]any, error) {
	return a.hermes.RuntimeDiagnostics()
}

func (a *App) StartHermesAgent() (*HermesStatus, error) {
	return a.hermes.Start()
}

func (a *App) CreateHermesSession(spaceID string) (string, error) {
	return a.hermes.CreateSession(spaceID)
}

func (a *App) ListHermesSessions(spaceID string, page int, pageSize int) (*HermesSessionList, error) {
	return a.hermes.ListSessions(spaceID, page, pageSize)
}

func (a *App) GetHermesSessionHistory(spaceID string, sessionID string, page int, pageSize int) (*HermesMessageList, error) {
	return a.hermes.GetSessionHistory(spaceID, sessionID, page, pageSize)
}

func (a *App) SendHermesMessage(req HermesSendMessageRequest) (*HermesSendMessageResponse, error) {
	return a.hermes.SendMessage(req)
}

func (a *App) StopHermesSession(sessionID string) error {
	return a.hermes.StopSession(sessionID)
}

func (a *App) RenameHermesSession(spaceID string, sessionID string, firstMessage string) (*HermesRenameSessionResponse, error) {
	return a.hermes.RenameSession(spaceID, sessionID, firstMessage)
}

func (a *App) DeleteHermesSession(spaceID string, sessionID string) error {
	return a.hermes.DeleteSession(spaceID, sessionID)
}

func localPathFromOpenRequest(req OpenLocalPathRequest) (string, error) {
	raw := strings.TrimSpace(req.Path)
	if raw == "" {
		raw = strings.TrimSpace(req.URL)
	}
	if raw == "" {
		return "", fmt.Errorf("local file path is required")
	}

	if strings.HasPrefix(strings.ToLower(raw), "file:") {
		parsed, err := url.Parse(raw)
		if err != nil {
			return "", err
		}
		if parsed.Scheme != "file" {
			return "", fmt.Errorf("unsupported local file URL scheme: %s", parsed.Scheme)
		}
		if parsed.Host != "" && parsed.Host != "localhost" {
			return "", fmt.Errorf("remote file URLs are not supported: %s", parsed.Host)
		}
		raw = parsed.Path
	}

	if strings.HasPrefix(raw, "~"+string(os.PathSeparator)) {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		raw = filepath.Join(home, strings.TrimPrefix(raw, "~"+string(os.PathSeparator)))
	}

	path, err := filepath.Abs(raw)
	if err != nil {
		return "", err
	}
	path = filepath.Clean(path)
	if !filepath.IsAbs(path) {
		return "", fmt.Errorf("local file path must be absolute")
	}
	return path, nil
}

func openLocalPath(path string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", path)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", path)
	default:
		cmd = exec.Command("xdg-open", path)
	}
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to open local file: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}
