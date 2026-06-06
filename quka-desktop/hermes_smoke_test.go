package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestHermesBridgeBinarySmoke(t *testing.T) {
	requireHermesSmoke(t)

	bin := hermesSmokeBridgeBin(t)
	port, err := pickPort()
	if err != nil {
		t.Fatal(err)
	}
	token := "test-token-" + randomID()
	wsURL := fmt.Sprintf("ws://127.0.0.1:%d/api/ws?token=%s", port, token)

	cmd := exec.Command(bin, "--host", "127.0.0.1", "--port", fmt.Sprintf("%d", port), "--token="+token, "--model=fake/test-model")
	startupLogs := &processLogBuffer{}
	cmd.Stdout = startupLogs
	cmd.Stderr = startupLogs
	cmd.Env = hermesSmokeEnv(t, token)
	if err := cmd.Start(); err != nil {
		t.Fatalf("start bridge: %v", err)
	}
	defer func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
	}()

	waitCh := make(chan error, 1)
	go func() { waitCh <- cmd.Wait() }()

	conn, err := waitForHermesWebSocket(wsURL, waitCh, startupLogs)
	if err != nil {
		t.Fatalf("wait bridge websocket: %v", err)
	}
	defer conn.Close()

	sessionID := smokeCreateSession(t, conn)
	smokeSubmitAndAssertEvents(t, conn, sessionID, "hello from bridge smoke")
}

func TestHermesAgentServiceSmokeWithFakeBridge(t *testing.T) {
	requireHermesSmoke(t)

	bin := hermesSmokeBridgeBin(t)
	home := t.TempDir()
	t.Setenv("HERMES_BRIDGE_BIN", bin)
	t.Setenv("QUKA_HERMES_HOME", home)
	t.Setenv("QUKA_HERMES_FAKE_AGENT", "1")

	if err := writeHermesProviderConfig(HermesProviderConfigureRequest{
		ModelName:    "fake/service-model",
		BaseURL:      "https://models.invalid/v1",
		APIKey:       "model-key",
		TavilyAPIKey: "tvly-test",
	}); err != nil {
		t.Fatal(err)
	}
	if err := writeHermesEnv(HermesProviderConfigureRequest{APIKey: "model-key", TavilyAPIKey: "tvly-test"}); err != nil {
		t.Fatal(err)
	}
	if err := writeQukaSkillConfig(HermesConfigureRequest{
		Host:        "https://quka.invalid",
		AccessToken: "test-access-token",
		SpaceID:     "test-space",
		Resource:    "knowledge",
	}); err != nil {
		t.Fatal(err)
	}

	service := NewHermesAgentService()
	defer service.restart()

	status, err := service.Start()
	if err != nil {
		t.Fatalf("service start: %v", err)
	}
	if !status.Ready {
		t.Fatalf("service not ready: %+v", status)
	}
	pidBefore := hermesServicePID(t, service)
	if _, err := service.reloadProviderOrStart(HermesProviderConfigureRequest{ModelName: "fake/reloaded-model"}); err != nil {
		t.Fatalf("reload provider: %v", err)
	}
	if pidAfter := hermesServicePID(t, service); pidAfter != pidBefore {
		t.Fatalf("provider reload restarted bridge pid before=%d after=%d", pidBefore, pidAfter)
	}

	sessionID, err := service.CreateSession("test-space")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if _, err := service.SendMessage(HermesSendMessageRequest{
		SpaceID:   "test-space",
		SessionID: sessionID,
		MessageID: "test-message",
		Message:   "hello from service smoke",
	}); err != nil {
		t.Fatalf("send message: %v", err)
	}

	var history *HermesMessageList
	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); {
		history, err = service.GetSessionHistory("test-space", sessionID, 1, 20)
		if err != nil {
			t.Fatalf("get history: %v", err)
		}
		if history.Total >= 2 {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	if history == nil || history.Total < 2 {
		t.Fatalf("history did not include fake turn: %+v", history)
	}
	if got := history.List[len(history.List)-1].Meta.Message["text"]; got != "fake hermes response: hello from service smoke" {
		t.Fatalf("assistant content = %v", got)
	}
}

func hermesServicePID(t *testing.T, service *HermesAgentService) int {
	t.Helper()
	service.mu.Lock()
	defer service.mu.Unlock()
	if service.proc == nil || service.proc.Process == nil {
		t.Fatal("bridge process is not running")
	}
	return service.proc.Process.Pid
}

func requireHermesSmoke(t *testing.T) {
	t.Helper()
	if os.Getenv("QUKA_HERMES_SMOKE") != "1" {
		t.Skip("set QUKA_HERMES_SMOKE=1 to run embedded Hermes bridge smoke tests")
	}
}

func hermesSmokeBridgeBin(t *testing.T) string {
	t.Helper()
	bin := os.Getenv("HERMES_BRIDGE_BIN")
	if bin == "" {
		candidates := bundledHermesBridgeCandidates()
		for _, candidate := range candidates {
			if resolved, ok := executableFromPathOrDir(candidate); ok {
				bin = resolved
				break
			}
		}
	} else if resolved, ok := executableFromPathOrDir(bin); ok {
		bin = resolved
	}
	if bin == "" || !isExecutableFile(bin) {
		t.Skip("set HERMES_BRIDGE_BIN to quka-hermes-bridge, or build it with ./build-hermes-runtime.sh")
	}
	return bin
}

func hermesSmokeEnv(t *testing.T, token string) []string {
	t.Helper()
	home := t.TempDir()
	return append(cleanHermesBridgeEnv(os.Environ()),
		"HERMES_HOME="+home,
		"QUKA_AI_CONFIG="+filepath.Join(home, "quka-ai", "config.json"),
		"HERMES_DASHBOARD_SESSION_TOKEN="+token,
		"QUKA_HERMES_FAKE_AGENT=1",
		"PYINSTALLER_RESET_ENVIRONMENT=1",
	)
}

func smokeCreateSession(t *testing.T, conn *websocket.Conn) string {
	t.Helper()
	if err := conn.WriteJSON(rpcRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "session.create",
		Params:  map[string]any{"title": "Smoke"},
	}); err != nil {
		t.Fatalf("write session.create: %v", err)
	}

	for {
		frame := smokeReadFrame(t, conn)
		if frame.ID == nil || *frame.ID != 1 {
			continue
		}
		if frame.Error != nil {
			t.Fatalf("session.create error: %s", frame.Error.Message)
		}
		var out struct {
			SessionID string `json:"session_id"`
		}
		if err := json.Unmarshal(frame.Result, &out); err != nil {
			t.Fatalf("decode session.create: %v", err)
		}
		if out.SessionID == "" {
			t.Fatal("session.create returned empty session id")
		}
		return out.SessionID
	}
}

func smokeSubmitAndAssertEvents(t *testing.T, conn *websocket.Conn, sessionID string, text string) {
	t.Helper()
	if err := conn.WriteJSON(rpcRequest{
		JSONRPC: "2.0",
		ID:      2,
		Method:  "prompt.submit",
		Params:  map[string]any{"session_id": sessionID, "text": text},
	}); err != nil {
		t.Fatalf("write prompt.submit: %v", err)
	}

	gotSubmitResponse := false
	gotStart := false
	gotDelta := false
	gotComplete := false
	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); {
		frame := smokeReadFrame(t, conn)
		if frame.ID != nil && *frame.ID == 2 {
			if frame.Error != nil {
				t.Fatalf("prompt.submit error: %s", frame.Error.Message)
			}
			gotSubmitResponse = true
			continue
		}
		if frame.Method != "event" {
			continue
		}
		var event gatewayEvent
		if err := json.Unmarshal(frame.Params, &event); err != nil {
			t.Fatalf("decode event: %v", err)
		}
		switch event.Type {
		case "message.start":
			gotStart = true
		case "message.delta":
			var payload struct {
				Text string `json:"text"`
			}
			if err := json.Unmarshal(event.Payload, &payload); err != nil {
				t.Fatalf("decode delta: %v", err)
			}
			if payload.Text == "fake hermes response: "+text {
				gotDelta = true
			}
		case "message.complete":
			var payload struct {
				Status string `json:"status"`
			}
			if err := json.Unmarshal(event.Payload, &payload); err != nil {
				t.Fatalf("decode complete: %v", err)
			}
			gotComplete = payload.Status == "ok"
		}
		if gotSubmitResponse && gotStart && gotDelta && gotComplete {
			return
		}
	}
	t.Fatalf("missing expected bridge events: response=%t start=%t delta=%t complete=%t", gotSubmitResponse, gotStart, gotDelta, gotComplete)
}

func smokeReadFrame(t *testing.T, conn *websocket.Conn) rpcFrame {
	t.Helper()
	if err := conn.SetReadDeadline(time.Now().Add(5 * time.Second)); err != nil {
		t.Fatalf("set read deadline: %v", err)
	}
	var frame rpcFrame
	if err := conn.ReadJSON(&frame); err != nil {
		t.Fatalf("read frame: %v", err)
	}
	return frame
}
