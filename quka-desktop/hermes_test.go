package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"

	"gopkg.in/yaml.v3"
)

func TestHermesHomeDirUsesQukaOverride(t *testing.T) {
	t.Setenv("QUKA_HERMES_HOME", filepath.Join("tmp", "quka-hermes"))

	got, err := hermesHomeDir()
	if err != nil {
		t.Fatal(err)
	}
	if got != filepath.Join("tmp", "quka-hermes") {
		t.Fatalf("hermesHomeDir() = %q", got)
	}
}

func TestHermesHomeDirDefaultsToAppConfig(t *testing.T) {
	t.Setenv("QUKA_HERMES_HOME", "")

	base, err := os.UserConfigDir()
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(base, "QukaAI", "hermes")

	got, err := hermesHomeDir()
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("hermesHomeDir() = %q, want %q", got, want)
	}
}

func TestQukaDesktopTmpDirUsesAppDataDateFolder(t *testing.T) {
	hermesHome := filepath.Join("Users", "test", "Library", "Application Support", "QukaAI", "hermes")
	got := qukaDesktopTmpDirForDate(hermesHome, time.Date(2026, 6, 6, 12, 0, 0, 0, time.Local))
	want := filepath.Join("Users", "test", "Library", "Application Support", "QukaAI", "tmp", "2026-06-06")
	if got != want {
		t.Fatalf("qukaDesktopTmpDirForDate() = %q, want %q", got, want)
	}
}

func TestCleanupQukaDesktopTmpRootRemovesEntriesOlderThanRetention(t *testing.T) {
	tmpRoot := t.TempDir()
	now := time.Date(2026, 6, 9, 12, 0, 0, 0, time.Local)
	for _, name := range []string{"2026-05-08", "2026-05-09", "2026-06-09"} {
		if err := os.MkdirAll(filepath.Join(tmpRoot, name), 0700); err != nil {
			t.Fatal(err)
		}
	}

	removed, err := cleanupQukaDesktopTmpRoot(tmpRoot, now, hermesLocalRetentionDays)
	if err != nil {
		t.Fatal(err)
	}

	if removed != 1 {
		t.Fatalf("removed = %d, want 1", removed)
	}
	if _, err := os.Stat(filepath.Join(tmpRoot, "2026-05-08")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("expired tmp dir should be removed, stat err=%v", err)
	}
	for _, name := range []string{"2026-05-09", "2026-06-09"} {
		if _, err := os.Stat(filepath.Join(tmpRoot, name)); err != nil {
			t.Fatalf("tmp dir %s should be kept: %v", name, err)
		}
	}
}

func TestCleanHermesBridgeEnvRemovesHostTempDirs(t *testing.T) {
	cleaned := cleanHermesBridgeEnv([]string{
		"PATH=/usr/bin",
		"TMPDIR=/tmp/host",
		"TEMP=/tmp/host",
		"TMP=/tmp/host",
		"QUKA_DESKTOP_TMP_ROOT=/tmp/old-root",
		"QUKA_DESKTOP_TMP_DIR=/tmp/old",
	})
	text := "\n" + strings.Join(cleaned, "\n") + "\n"
	for _, unwanted := range []string{"\nTMPDIR=", "\nTEMP=", "\nTMP=", "\nQUKA_DESKTOP_TMP_ROOT=", "\nQUKA_DESKTOP_TMP_DIR="} {
		if strings.Contains(text, unwanted) {
			t.Fatalf("cleanHermesBridgeEnv kept %q in %v", unwanted, cleaned)
		}
	}
	if !strings.Contains(text, "\nPATH=/usr/bin\n") {
		t.Fatalf("cleanHermesBridgeEnv dropped PATH: %v", cleaned)
	}
}

func TestPruneExpiredSessionsUsesThirtyOneDayRetention(t *testing.T) {
	service := NewHermesAgentService()
	now := time.Date(2026, 6, 9, 12, 0, 0, 0, time.Local)
	expired := now.AddDate(0, 0, -32).Unix()
	boundary := now.AddDate(0, 0, -31).Unix()
	recent := now.AddDate(0, 0, -2).Unix()

	service.sessions["expired"] = &HermesSession{ID: "expired", LatestAccessTime: expired}
	service.sessions["boundary"] = &HermesSession{ID: "boundary", LatestAccessTime: boundary}
	service.sessions["recent"] = &HermesSession{ID: "recent", LatestAccessTime: recent}
	service.sessions["fallback-history"] = &HermesSession{ID: "fallback-history"}
	service.histories["expired"] = []HermesMessageDetail{{Meta: HermesMessageMeta{SendTime: expired}}}
	service.histories["boundary"] = []HermesMessageDetail{{Meta: HermesMessageMeta{SendTime: boundary}}}
	service.histories["recent"] = []HermesMessageDetail{{Meta: HermesMessageMeta{SendTime: recent}}}
	service.histories["fallback-history"] = []HermesMessageDetail{{Meta: HermesMessageMeta{SendTime: recent}}}
	service.histories["orphan"] = []HermesMessageDetail{{Meta: HermesMessageMeta{SendTime: recent}}}
	service.messageSeq["expired"] = 3
	service.messageSeq["boundary"] = 4
	service.messageSeq["orphan"] = 5
	service.activeTurns["expired"] = &activeTurn{MessageID: "m"}
	service.restored["expired"] = true

	removed := service.pruneExpiredSessionsLocked(now, hermesLocalRetentionDays)

	if removed != 2 {
		t.Fatalf("removed = %d, want expired session and orphan history", removed)
	}
	for _, sessionID := range []string{"expired", "orphan"} {
		if _, ok := service.sessions[sessionID]; ok {
			t.Fatalf("session %s should be removed", sessionID)
		}
		if _, ok := service.histories[sessionID]; ok {
			t.Fatalf("history %s should be removed", sessionID)
		}
		if _, ok := service.messageSeq[sessionID]; ok {
			t.Fatalf("message sequence %s should be removed", sessionID)
		}
	}
	for _, sessionID := range []string{"boundary", "recent", "fallback-history"} {
		if _, ok := service.sessions[sessionID]; !ok {
			t.Fatalf("session %s should be kept", sessionID)
		}
		if _, ok := service.histories[sessionID]; !ok {
			t.Fatalf("history %s should be kept", sessionID)
		}
	}
}

func TestWriteHermesProviderConfigWritesModelAndTavilyBackend(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	path := filepath.Join(home, "config.yaml")
	if err := os.WriteFile(path, []byte("existing:\n  keep: true\nweb:\n  timeout: 30\n"), 0600); err != nil {
		t.Fatal(err)
	}

	err := writeHermesProviderConfig(HermesProviderConfigureRequest{
		ModelName: "openai/qwen3.5:27b",
		BaseURL:   "http://localhost:11434/v1/",
		APIKey:    "model-key",
	})
	if err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	config := map[string]any{}
	if err := yaml.Unmarshal(raw, &config); err != nil {
		t.Fatal(err)
	}

	model := config["model"].(map[string]any)
	if model["default"] != "openai/qwen3.5:27b" {
		t.Fatalf("model.default = %v", model["default"])
	}
	if model["provider"] != "custom" {
		t.Fatalf("model.provider = %v", model["provider"])
	}
	if model["base_url"] != "http://localhost:11434/v1" {
		t.Fatalf("model.base_url = %v", model["base_url"])
	}
	if model["api_mode"] != "chat_completions" {
		t.Fatalf("model.api_mode = %v", model["api_mode"])
	}
	if model["api_key"] != "model-key" {
		t.Fatalf("model.api_key = %v", model["api_key"])
	}

	web := config["web"].(map[string]any)
	if _, ok := web["backend"]; ok {
		t.Fatalf("web.backend should not be forced without Tavily key: %v", web["backend"])
	}
	if web["timeout"] != 30 {
		t.Fatalf("web.timeout = %v", web["timeout"])
	}

	existing := config["existing"].(map[string]any)
	if existing["keep"] != true {
		t.Fatalf("existing.keep = %v", existing["keep"])
	}
}

func TestWriteHermesEnvWritesModelKeyAndPreservesExistingValues(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	path := filepath.Join(home, ".env")
	if err := os.WriteFile(path, []byte("# keep me\nFOO=bar\nOPENAI_API_KEY=old-model\nTAVILY_API_KEY=old\n"), 0600); err != nil {
		t.Fatal(err)
	}

	err := writeHermesEnv(HermesProviderConfigureRequest{
		ModelName:    "model",
		BaseURL:      "https://models.example/v1",
		APIKey:       "new model key",
		TavilyAPIKey: "new tavily value",
	})
	if err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(raw)
	for _, want := range []string{
		"# keep me\n",
		"FOO=bar\n",
		"OPENAI_API_KEY=\"new model key\"\n",
		"TAVILY_API_KEY=\"new tavily value\"\n",
	} {
		if !strings.Contains(text, want) {
			t.Fatalf(".env missing %q in:\n%s", want, text)
		}
	}
	if strings.Contains(text, "TAVILY_API_KEY=old") {
		t.Fatalf(".env kept old Tavily key:\n%s", text)
	}
	if strings.Contains(text, "OPENAI_API_KEY=old-model") {
		t.Fatalf(".env kept old model key:\n%s", text)
	}
}

func TestWriteHermesUserEnvironmentStoresToolTokenWithoutExposingValue(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	updates, removals, err := writeHermesUserEnvironment([]HermesEnvironmentVariable{
		{Name: "GH_TOKEN", Value: "ghp-test-token"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if updates["GH_TOKEN"] != "ghp-test-token" {
		t.Fatalf("updates[GH_TOKEN] = %q", updates["GH_TOKEN"])
	}
	if len(removals) != 0 {
		t.Fatalf("removals = %v", removals)
	}

	variables, err := hermesUserEnvironmentVariables()
	if err != nil {
		t.Fatal(err)
	}
	if len(variables) != 1 || variables[0].Name != "GH_TOKEN" || !variables[0].Configured || variables[0].Value != "" {
		t.Fatalf("unexpected variables: %+v", variables)
	}
}

func TestWriteHermesUserEnvironmentRejectsManagedVariables(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	_, _, err := writeHermesUserEnvironment([]HermesEnvironmentVariable{
		{Name: "QUKA_ACCESS_TOKEN", Value: "should-not-write"},
	})
	if err == nil {
		t.Fatal("expected managed variable error")
	}
	raw, readErr := os.ReadFile(filepath.Join(home, ".env"))
	if readErr == nil && strings.Contains(string(raw), "should-not-write") {
		t.Fatalf("managed value was written:\n%s", string(raw))
	}
}

func TestNormalizeQukaAPIBaseURLAppendsAPIV1(t *testing.T) {
	for _, tt := range []struct {
		name string
		raw  string
		want string
	}{
		{name: "root endpoint", raw: "https://quka.example", want: "https://quka.example/api/v1"},
		{name: "api endpoint", raw: "https://quka.example/api/", want: "https://quka.example/api/v1"},
		{name: "already versioned", raw: "https://quka.example/api/v1/", want: "https://quka.example/api/v1"},
		{name: "self hosted with base path", raw: "https://quka.example/quka", want: "https://quka.example/quka/api/v1"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeQukaAPIBaseURL(tt.raw); got != tt.want {
				t.Fatalf("normalizeQukaAPIBaseURL(%q) = %q, want %q", tt.raw, got, tt.want)
			}
		})
	}
}

func TestHermesAgentHistoryPrefersProviderText(t *testing.T) {
	history := []HermesMessageDetail{
		{
			Meta: HermesMessageMeta{
				Role: 2,
				Message: map[string]any{
					"text":          "secret",
					"provider_text": "$hidden[secret]",
				},
			},
		},
	}

	got := hermesAgentHistoryFromQukaMessages(history)
	if len(got) != 1 {
		t.Fatalf("history length = %d, want 1", len(got))
	}
	if got[0]["content"] != "$hidden[secret]" {
		t.Fatalf("history content = %v, want provider-safe hidden marker", got[0]["content"])
	}
}

func readBundledQukaSkillHelper(t *testing.T) string {
	t.Helper()
	skillsDir, err := resolveHermesBundledSkillsDir()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(skillsDir, "quka-ai", "scripts", "quka_ai.py"))
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

func readBundledSkillFile(t *testing.T, skillName string, parts ...string) string {
	t.Helper()
	skillsDir, err := resolveHermesBundledSkillsDir()
	if err != nil {
		t.Fatal(err)
	}
	pathParts := append([]string{skillsDir, skillName}, parts...)
	raw, err := os.ReadFile(filepath.Join(pathParts...))
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

func TestQukaJournalSkillUsesSpacePrefixedRoutes(t *testing.T) {
	helper := readBundledQukaSkillHelper(t)
	for _, want := range []string{
		`def journal_space_path(cfg, suffix):`,
		`return "/space/" + urllib.parse.quote(str(cfg["space_id"]), safe="") + suffix`,
		`journal_space_path(cfg, "/journal")`,
		`journal_space_path(cfg, "/journal/list")`,
	} {
		if !strings.Contains(helper, want) {
			t.Fatalf("quka skill helper missing %q", want)
		}
	}
	if strings.Contains(helper, `api_request(cfg, "GET", space_path(cfg, "/journal"`) {
		t.Fatalf("journal route should not use legacy space_path")
	}
}

func TestQukaJournalSkillOmitsClientSourceForRawBlockNoteWrites(t *testing.T) {
	helper := readBundledQukaSkillHelper(t)
	for _, want := range []string{
		`if client_source:`,
		`raw_response = api_request(cfg, "GET", journal_space_path(cfg, "/journal"), params=params, client_source="")`,
		`response = api_request(cfg, "GET", journal_space_path(cfg, "/journal/list"), params=params, client_source="")`,
		`client_source="",`,
	} {
		if !strings.Contains(helper, want) {
			t.Fatalf("quka skill helper missing %q", want)
		}
	}
	if strings.Contains(helper, `client_source="hermes-agent"`) {
		t.Fatalf("journal raw requests should omit X-Client-Source because current remote treats any non-empty value as app")
	}
}

func TestQukaKnowledgeSkillKeepsRootSpaceRoutes(t *testing.T) {
	helper := readBundledQukaSkillHelper(t)
	if !strings.Contains(helper, `space_path(cfg, "/knowledge/query")`) {
		t.Fatalf("knowledge query should use /<space_id>/knowledge/query route")
	}
	if strings.Contains(helper, `journal_space_path(cfg, "/knowledge`) {
		t.Fatalf("knowledge route should not use /space/<space_id> helper")
	}
}

func TestWriteQukaSkillConfigWritesRemoteAPIAuthContext(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	if err := writeQukaSkillConfig(HermesConfigureRequest{
		APIBaseURL: "https://quka.example/api/",
		AuthToken:  "user-token",
		TokenType:  "authorization",
		SpaceID:    "space-1",
		Resource:   "knowledge",
	}); err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(filepath.Join(home, "quka-ai", "config.json"))
	if err != nil {
		t.Fatal(err)
	}
	config := map[string]any{}
	if err := json.Unmarshal(raw, &config); err != nil {
		t.Fatal(err)
	}
	for key, want := range map[string]string{
		"api_base_url": "https://quka.example/api/v1",
		"auth_token":   "user-token",
		"host":         "https://quka.example/api/v1",
		"token_type":   "authorization",
		"space_id":     "space-1",
		"resource":     "knowledge",
	} {
		if config[key] != want {
			t.Fatalf("%s = %v, want %q", key, config[key], want)
		}
	}
	if _, ok := config["access_token"]; ok {
		t.Fatalf("authorization config should not write access_token: %v", config)
	}
}

func TestWriteQukaSkillConfigAcceptsLegacyHostAndAccessToken(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	if err := writeQukaSkillConfig(HermesConfigureRequest{
		Host:        "https://legacy.example/api/",
		AccessToken: "legacy-token",
		SpaceID:     "space-legacy",
		Resource:    "knowledge",
	}); err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(filepath.Join(home, "quka-ai", "config.json"))
	if err != nil {
		t.Fatal(err)
	}
	config := map[string]any{}
	if err := json.Unmarshal(raw, &config); err != nil {
		t.Fatal(err)
	}
	if config["api_base_url"] != "https://legacy.example/api/v1" {
		t.Fatalf("api_base_url = %v", config["api_base_url"])
	}
	if config["access_token"] != "legacy-token" {
		t.Fatalf("access_token = %v", config["access_token"])
	}
	if _, ok := config["auth_token"]; ok {
		t.Fatalf("legacy access token config should not write auth_token: %v", config)
	}
	if config["token_type"] != "access" {
		t.Fatalf("token_type = %v", config["token_type"])
	}
}

func TestEnsureHermesBundledSkillsConfiguredRegistersBundledJournalSkill(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	if err := ensureHermesBundledSkillsConfigured(); err != nil {
		t.Fatal(err)
	}

	rawConfig, err := os.ReadFile(filepath.Join(home, "config.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	config := map[string]any{}
	if err := yaml.Unmarshal(rawConfig, &config); err != nil {
		t.Fatal(err)
	}
	externalDirs := stringSliceValue(mapValue(config["skills"])["external_dirs"])
	bundledSkillsDir, err := resolveHermesBundledSkillsDir()
	if err != nil {
		t.Fatal(err)
	}
	if !stringSliceContains(externalDirs, bundledSkillsDir) {
		t.Fatalf("skills.external_dirs = %v, want %q", externalDirs, bundledSkillsDir)
	}

	journalRoot := filepath.Join(bundledSkillsDir, "quka-journal")

	journalSkill, err := os.ReadFile(filepath.Join(journalRoot, "SKILL.md"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(journalSkill), "journal-list") {
		t.Fatalf("journal skill should mention journal-list:\n%s", string(journalSkill))
	}

	helper, err := os.ReadFile(filepath.Join(journalRoot, "scripts", "quka_ai.py"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(helper), "command_journal_list") {
		t.Fatalf("journal helper should include command_journal_list")
	}

	agentsRoot := filepath.Join(bundledSkillsDir, "quka-agents")
	agentsSkill, err := os.ReadFile(filepath.Join(agentsRoot, "SKILL.md"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(agentsSkill), "run-agents") {
		t.Fatalf("agents skill should mention run-agents")
	}

	agentsHelper, err := os.ReadFile(filepath.Join(agentsRoot, "scripts", "quka_agents.py"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(agentsHelper), "QUKA_HERMES_BRIDGE_BIN") {
		t.Fatalf("agents helper should locate bridge from QUKA_HERMES_BRIDGE_BIN")
	}
}

func TestQukaAgentsSkillIsBundledAndReserved(t *testing.T) {
	skill := readBundledSkillFile(t, "quka-agents", "SKILL.md")
	if !strings.Contains(skill, "Multi-Agent Collaboration") {
		t.Fatalf("quka-agents skill missing collaboration instructions")
	}
	if !strings.Contains(skill, "profiles.json") {
		t.Fatalf("quka-agents skill should mention user-created agent profiles")
	}
	if !strings.Contains(skill, "${HERMES_SKILL_DIR}/scripts/quka_agents.py") {
		t.Fatalf("quka-agents skill should use Hermes template skill directory")
	}
	if !isReservedHermesSkillName("quka-agents") {
		t.Fatalf("quka-agents should be reserved")
	}
}

func TestHermesAgentProfilesSaveListDelete(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	if err := hermesSaveAgentProfile(HermesAgentProfile{
		ID:              "github-issue-agent",
		Name:            "GitHub Issue Agent",
		Description:     "Works with GitHub issues.",
		SystemPrompt:    "Focus on GitHub issue triage.",
		ToolPolicy:      "restricted",
		EnabledToolsets: []string{"terminal", "skills", "terminal"},
		EnabledSkills:   []string{"quka-ai"},
		ContextPolicy:   "summary",
	}); err != nil {
		t.Fatal(err)
	}

	list, err := hermesAgentProfiles()
	if err != nil {
		t.Fatal(err)
	}
	if list.ProfilesPath != filepath.Join(home, "agents", "profiles.json") {
		t.Fatalf("ProfilesPath = %q", list.ProfilesPath)
	}
	var saved *HermesAgentProfile
	for i := range list.Profiles {
		if list.Profiles[i].ID == "github-issue-agent" {
			saved = &list.Profiles[i]
			break
		}
	}
	if saved == nil {
		t.Fatalf("saved profile not listed: %+v", list.Profiles)
	}
	if saved.BuiltIn {
		t.Fatalf("saved profile should not be built-in")
	}
	if strings.Join(saved.EnabledToolsets, ",") != "terminal,skills" {
		t.Fatalf("EnabledToolsets = %v", saved.EnabledToolsets)
	}
	if saved.ToolPolicy != "restricted" || saved.ContextPolicy != "summary" {
		t.Fatalf("policy = %q context = %q", saved.ToolPolicy, saved.ContextPolicy)
	}

	raw, err := os.ReadFile(filepath.Join(home, "agents", "profiles.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "github-issue-agent") || !strings.Contains(string(raw), "Focus on GitHub issue triage.") {
		t.Fatalf("profile file missing saved content:\n%s", string(raw))
	}

	if err := hermesDeleteAgentProfile("github-issue-agent"); err != nil {
		t.Fatal(err)
	}
	list, err = hermesAgentProfiles()
	if err != nil {
		t.Fatal(err)
	}
	for _, profile := range list.Profiles {
		if profile.ID == "github-issue-agent" {
			t.Fatalf("profile should have been deleted: %+v", profile)
		}
	}
}

func TestHermesAgentProfilesProtectBuiltIns(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	if err := hermesSaveAgentProfile(HermesAgentProfile{
		ID:           "researcher",
		Name:         "Researcher",
		SystemPrompt: "overwrite",
	}); err == nil {
		t.Fatalf("expected built-in overwrite to fail")
	}
	if err := hermesDeleteAgentProfile("researcher"); err == nil {
		t.Fatalf("expected built-in delete to fail")
	}
}

func TestHermesInstallSkillCopiesUserSkill(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	source := filepath.Join(t.TempDir(), "my-skill-source")
	if err := os.MkdirAll(filepath.Join(source, "scripts"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(source, "SKILL.md"), []byte("---\nname: my-skill\ndescription: Test skill\n---\n# Test\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(source, "scripts", "run.py"), []byte("print('ok')\n"), 0644); err != nil {
		t.Fatal(err)
	}

	if err := hermesInstallSkill(HermesSkillInstallRequest{SourcePath: source}); err != nil {
		t.Fatal(err)
	}

	dest := filepath.Join(home, "skills", "my-skill")
	if _, err := os.Stat(filepath.Join(dest, "SKILL.md")); err != nil {
		t.Fatal(err)
	}
	scriptInfo, err := os.Stat(filepath.Join(dest, "scripts", "run.py"))
	if err != nil {
		t.Fatal(err)
	}
	if scriptInfo.Mode().Perm()&0100 == 0 {
		t.Fatalf("installed python helper should be executable, mode=%o", scriptInfo.Mode().Perm())
	}
}

func TestHermesDeleteSkillRemovesUserSkill(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	skillDir := filepath.Join(home, "skills", "delete-me")
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("---\nname: delete-me\n---\n# Delete me\n"), 0644); err != nil {
		t.Fatal(err)
	}

	if err := hermesDeleteSkill(HermesSkillDeleteRequest{Name: "delete-me", Source: "user", Path: skillDir}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(skillDir); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("expected skill dir to be removed, stat err=%v", err)
	}
}

func TestHermesDeleteSkillRejectsBundledSkill(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	err := hermesDeleteSkill(HermesSkillDeleteRequest{Name: "quka-ai", Source: "built-in"})
	if err == nil || !strings.Contains(err.Error(), "bundled Hermes skill") {
		t.Fatalf("expected bundled skill deletion rejection, got %v", err)
	}
}

func TestHermesInstallSkillRejectsBundledSkillName(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	source := filepath.Join(t.TempDir(), "quka-ai")
	if err := os.MkdirAll(source, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(source, "SKILL.md"), []byte("---\nname: quka-ai\n---\n"), 0644); err != nil {
		t.Fatal(err)
	}

	err := hermesInstallSkill(HermesSkillInstallRequest{SourcePath: source})
	if err == nil || !strings.Contains(err.Error(), "bundled Hermes skill") {
		t.Fatalf("expected bundled skill rejection, got %v", err)
	}
}

func TestHermesInstallSkillRejectsMissingSkillMarkdown(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	source := t.TempDir()
	err := hermesInstallSkill(HermesSkillInstallRequest{SourcePath: source})
	if err == nil || !strings.Contains(err.Error(), "SKILL.md") {
		t.Fatalf("expected missing SKILL.md rejection, got %v", err)
	}
}

func TestWriteQukaMemoryProviderConfigEnablesProviderAndStoresAccessTokenInEnv(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	if err := writeQukaMemoryProviderConfig(HermesConfigureRequest{
		APIBaseURL:  "https://quka.example/api/v1/",
		AccessToken: "user-token",
		TokenType:   "access",
		SpaceID:     "space-1",
		Resource:    "knowledge",
	}); err != nil {
		t.Fatal(err)
	}
	if err := enableQukaMemoryProvider(); err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(filepath.Join(home, "qukaai-memory.json"))
	if err != nil {
		t.Fatal(err)
	}
	config := map[string]any{}
	if err := json.Unmarshal(raw, &config); err != nil {
		t.Fatal(err)
	}
	if config["api_base_url"] != "https://quka.example/api/v1" {
		t.Fatalf("api_base_url = %v", config["api_base_url"])
	}
	if config["space_id"] != "space-1" {
		t.Fatalf("space_id = %v", config["space_id"])
	}
	if config["default_layer"] != "user_space" {
		t.Fatalf("default_layer = %v", config["default_layer"])
	}
	if _, ok := config["access_token"]; ok {
		t.Fatalf("qukaai-memory.json should not store access_token: %v", config)
	}
	if _, ok := config["auth_token"]; ok {
		t.Fatalf("qukaai-memory.json should not store auth_token: %v", config)
	}

	envRaw, err := os.ReadFile(filepath.Join(home, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	envText := string(envRaw)
	for _, want := range []string{
		"QUKA_API_BASE_URL=\"https://quka.example/api/v1\"\n",
		"QUKA_SPACE_ID=\"space-1\"\n",
		"QUKA_ACCESS_TOKEN=\"user-token\"\n",
		"QUKA_AUTH_TOKEN=\"\"\n",
	} {
		if !strings.Contains(envText, want) {
			t.Fatalf(".env missing %q in:\n%s", want, envText)
		}
	}

	configRaw, err := os.ReadFile(filepath.Join(home, "config.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	hermesConfig := map[string]any{}
	if err := yaml.Unmarshal(configRaw, &hermesConfig); err != nil {
		t.Fatal(err)
	}
	memory := hermesConfig["memory"].(map[string]any)
	if memory["provider"] != "qukaai" {
		t.Fatalf("memory.provider = %v", memory["provider"])
	}
}

func TestWriteQukaMemoryProviderConfigStoresAuthorizationTokenInEnv(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	if err := writeQukaMemoryProviderConfig(HermesConfigureRequest{
		APIBaseURL: "https://quka.example/api/v1/",
		AuthToken:  "login-token",
		TokenType:  "authorization",
		SpaceID:    "space-1",
		Resource:   "knowledge",
	}); err != nil {
		t.Fatal(err)
	}

	envRaw, err := os.ReadFile(filepath.Join(home, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	envText := string(envRaw)
	for _, want := range []string{
		"QUKA_API_BASE_URL=\"https://quka.example/api/v1\"\n",
		"QUKA_SPACE_ID=\"space-1\"\n",
		"QUKA_ACCESS_TOKEN=\"\"\n",
		"QUKA_AUTH_TOKEN=\"login-token\"\n",
	} {
		if !strings.Contains(envText, want) {
			t.Fatalf(".env missing %q in:\n%s", want, envText)
		}
	}
}

func TestToolTipsPayloadIncludesArgumentsAndResult(t *testing.T) {
	service := NewHermesAgentService()
	payload := []byte(`{"id":"tool-1","name":"knowledge-query","arguments":{"query":"pricing docs"},"result":{"ok":true,"data":[{"title":"Pricing"}]}}`)

	got := service.toolTipsPayload(payload, 2, "Completed")
	if got["id"] != "tool-1" {
		t.Fatalf("id = %v", got["id"])
	}
	if got["tool_name"] != "knowledge-query" {
		t.Fatalf("tool_name = %v", got["tool_name"])
	}
	if !strings.Contains(stringValue(got["arguments_text"]), "pricing docs") {
		t.Fatalf("arguments_text = %v", got["arguments_text"])
	}
	if !strings.Contains(stringValue(got["result_text"]), "Pricing") {
		t.Fatalf("result_text = %v", got["result_text"])
	}
}

func TestWriteHermesProviderConfigEnablesTavilyOnlyWhenConfigured(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	if err := writeHermesProviderConfig(HermesProviderConfigureRequest{
		ModelName:    "model",
		BaseURL:      "https://models.example/v1",
		APIKey:       "model-key",
		TavilyAPIKey: "tvly-test",
	}); err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(filepath.Join(home, "config.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	config := map[string]any{}
	if err := yaml.Unmarshal(raw, &config); err != nil {
		t.Fatal(err)
	}

	web := config["web"].(map[string]any)
	if web["backend"] != "tavily" {
		t.Fatalf("web.backend = %v", web["backend"])
	}
}

func TestWriteHermesProviderConfigEnablesTavilyFromExistingEnv(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	if err := writeHermesEnv(HermesProviderConfigureRequest{TavilyAPIKey: "tvly-existing"}); err != nil {
		t.Fatal(err)
	}
	if err := writeHermesProviderConfig(HermesProviderConfigureRequest{
		ModelName: "model",
		BaseURL:   "https://models.example/v1",
		APIKey:    "model-key",
	}); err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(filepath.Join(home, "config.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	config := map[string]any{}
	if err := yaml.Unmarshal(raw, &config); err != nil {
		t.Fatal(err)
	}
	web := config["web"].(map[string]any)
	if web["backend"] != "tavily" {
		t.Fatalf("web.backend = %v", web["backend"])
	}
}

func TestWriteHermesProviderConfigPreservesExistingKeysWhenBlank(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	if err := writeHermesProviderConfig(HermesProviderConfigureRequest{
		ModelName:    "old-model",
		BaseURL:      "https://models.example/v1",
		APIKey:       "old-key",
		TavilyAPIKey: "tvly-old",
	}); err != nil {
		t.Fatal(err)
	}
	if err := writeHermesProviderConfig(HermesProviderConfigureRequest{
		ModelName: "new-model",
		BaseURL:   "https://models.example/v2",
	}); err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(filepath.Join(home, "config.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	config := map[string]any{}
	if err := yaml.Unmarshal(raw, &config); err != nil {
		t.Fatal(err)
	}
	model := config["model"].(map[string]any)
	if model["api_key"] != "old-key" {
		t.Fatalf("model.api_key = %v", model["api_key"])
	}
	web := config["web"].(map[string]any)
	if web["backend"] != "tavily" {
		t.Fatalf("web.backend = %v", web["backend"])
	}
}

func TestWriteHermesEnvPreservesExistingValuesWhenBlank(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	if err := writeHermesEnv(HermesProviderConfigureRequest{APIKey: "old-model", TavilyAPIKey: "old-tavily"}); err != nil {
		t.Fatal(err)
	}
	if err := writeHermesEnv(HermesProviderConfigureRequest{TavilyAPIKey: "new-tavily"}); err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(filepath.Join(home, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	text := string(raw)
	if !strings.Contains(text, "OPENAI_API_KEY=\"old-model\"\n") {
		t.Fatalf(".env did not preserve model key:\n%s", text)
	}
	if !strings.Contains(text, "TAVILY_API_KEY=\"new-tavily\"\n") {
		t.Fatalf(".env did not update Tavily key:\n%s", text)
	}
}

func TestHermesProviderStoredConfigDetectsConfiguredKeys(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	if err := writeHermesProviderConfig(HermesProviderConfigureRequest{
		ModelName:    "model",
		BaseURL:      "https://models.example/v1",
		APIKey:       "model-key",
		TavilyAPIKey: "tvly-test",
	}); err != nil {
		t.Fatal(err)
	}
	if err := writeHermesEnv(HermesProviderConfigureRequest{
		APIKey:       "model-key",
		TavilyAPIKey: "tvly-test",
	}); err != nil {
		t.Fatal(err)
	}

	config, err := hermesProviderStoredConfig()
	if err != nil {
		t.Fatal(err)
	}
	if config.ModelName != "model" {
		t.Fatalf("ModelName = %q", config.ModelName)
	}
	if config.BaseURL != "https://models.example/v1" {
		t.Fatalf("BaseURL = %q", config.BaseURL)
	}
	if !config.APIKeyConfigured {
		t.Fatal("APIKeyConfigured = false")
	}
	if !config.TavilyConfigured {
		t.Fatal("TavilyConfigured = false")
	}
}

func TestHermesProviderConfiguredDetailsRequiresModelBaseURLAndAPIKey(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	configured, details, err := hermesProviderConfiguredDetails()
	if err != nil {
		t.Fatal(err)
	}
	if configured {
		t.Fatalf("configured before files exist: %+v", details)
	}

	if err := writeHermesProviderConfig(HermesProviderConfigureRequest{
		ModelName: "model",
		BaseURL:   "https://models.example/v1",
		APIKey:    "model-key",
	}); err != nil {
		t.Fatal(err)
	}
	configured, details, err = hermesProviderConfiguredDetails()
	if err != nil {
		t.Fatal(err)
	}
	if !configured {
		t.Fatalf("not configured with inline model/baseURL/API key: %+v", details)
	}
	if details.ModelName != "model" || details.BaseURL != "https://models.example/v1" || !details.APIKeyPresent {
		t.Fatalf("unexpected provider details: %+v", details)
	}
}

func TestHermesProviderConfiguredDetailsAllowsEnvAPIKeyFallback(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	path := filepath.Join(home, "config.yaml")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("model:\n  default: model\n  provider: custom\n  base_url: https://models.example/v1\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := writeHermesEnv(HermesProviderConfigureRequest{APIKey: "model-key"}); err != nil {
		t.Fatal(err)
	}

	configured, details, err := hermesProviderConfiguredDetails()
	if err != nil {
		t.Fatal(err)
	}
	if !configured {
		t.Fatalf("not configured with env API key fallback: %+v", details)
	}
	if details.ModelName != "model" || details.BaseURL != "https://models.example/v1" || !details.APIKeyPresent {
		t.Fatalf("unexpected provider details: %+v", details)
	}
}

func TestMigrateHermesProviderConfigCopiesEnvAPIKey(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	path := filepath.Join(home, "config.yaml")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("model:\n  default: GLM-5.1\n  provider: custom\n  base_url: https://ark.example/v3\nweb: {}\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := writeHermesEnv(HermesProviderConfigureRequest{APIKey: "ark-test-key"}); err != nil {
		t.Fatal(err)
	}

	if err := migrateHermesProviderConfig(); err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	config := map[string]any{}
	if err := yaml.Unmarshal(raw, &config); err != nil {
		t.Fatal(err)
	}
	model := config["model"].(map[string]any)
	if model["api_mode"] != "chat_completions" {
		t.Fatalf("model.api_mode = %v", model["api_mode"])
	}
	if model["api_key"] != "ark-test-key" {
		t.Fatalf("model.api_key = %v", model["api_key"])
	}
}

func TestMigrateHermesProviderConfigEnablesTavilyFromEnv(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	configPath := filepath.Join(home, "config.yaml")
	if err := os.WriteFile(configPath, []byte("model:\n  default: model\n  base_url: https://models.example/v1\n  api_key: model-key\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := writeHermesEnv(HermesProviderConfigureRequest{TavilyAPIKey: "tvly-existing"}); err != nil {
		t.Fatal(err)
	}
	if err := migrateHermesProviderConfig(); err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatal(err)
	}
	config := map[string]any{}
	if err := yaml.Unmarshal(raw, &config); err != nil {
		t.Fatal(err)
	}
	web := config["web"].(map[string]any)
	if web["backend"] != "tavily" {
		t.Fatalf("web.backend = %v", web["backend"])
	}
}

func TestHermesEventErrorMessage(t *testing.T) {
	service := NewHermesAgentService()
	got := service.eventErrorMessage([]byte(`{"message":"model provider rejected request"}`))
	if got != "model provider rejected request" {
		t.Fatalf("eventErrorMessage() = %q", got)
	}
}

func TestHermesToolResultError(t *testing.T) {
	service := NewHermesAgentService()
	got := service.toolResultError([]byte(`{"result":{"ok":false,"error":"Quka API unavailable"}}`))
	if got != "Quka API unavailable" {
		t.Fatalf("toolResultError() = %q", got)
	}

	if got := service.toolResultError([]byte(`{"result":{"ok":true,"data":[]}}`)); got != "" {
		t.Fatalf("toolResultError() for ok result = %q", got)
	}
}

func TestHermesMessageStartReusesActiveTurn(t *testing.T) {
	service := NewHermesAgentService()
	sessionID := "quka-hermes-test"
	answerID := "hermes-answer-existing"

	service.activeTurns[sessionID] = &activeTurn{MessageID: answerID, Initialized: true}
	service.messageSeq[sessionID] = 1

	service.handleGatewayEvent(gatewayEvent{
		Type:      "message.start",
		SessionID: sessionID,
	})

	turn := service.activeTurns[sessionID]
	if turn == nil {
		t.Fatal("active turn was removed")
	}
	if turn.MessageID != answerID {
		t.Fatalf("message.start changed active turn id = %q, want %q", turn.MessageID, answerID)
	}
	if service.messageSeq[sessionID] != 1 {
		t.Fatalf("message.start incremented existing sequence = %d, want 1", service.messageSeq[sessionID])
	}
}

func TestHermesToolBoundarySplitsAssistantSegments(t *testing.T) {
	service := NewHermesAgentService()
	sessionID := "quka-hermes-test"
	answerID := "hermes-answer-existing"

	service.activeTurns[sessionID] = &activeTurn{MessageID: answerID}
	service.messageSeq[sessionID] = 1

	service.handleGatewayEvent(gatewayEvent{
		Type:      "message.delta",
		SessionID: sessionID,
		Payload:   []byte(`{"text":"Before tool."}`),
	})
	if got := service.activeTurns[sessionID].MessageID; got != answerID {
		t.Fatalf("first assistant segment id = %q, want %q", got, answerID)
	}

	service.handleGatewayEvent(gatewayEvent{
		Type:      "tool.start",
		SessionID: sessionID,
		Payload:   []byte(`{"id":"tool-1","name":"web"}`),
	})
	if !service.activeTurns[sessionID].NeedsNewSegment {
		t.Fatal("tool boundary did not mark assistant segment split")
	}

	service.handleGatewayEvent(gatewayEvent{
		Type:      "message.delta",
		SessionID: sessionID,
		Payload:   []byte(`{"text":"After tool."}`),
	})
	turn := service.activeTurns[sessionID]
	if turn.MessageID == answerID {
		t.Fatalf("post-tool assistant reused pre-tool message id %q", answerID)
	}
	if turn.Text != "After tool." {
		t.Fatalf("post-tool segment text = %q", turn.Text)
	}
	if service.messageSeq[sessionID] != 2 {
		t.Fatalf("post-tool segment sequence = %d, want 2", service.messageSeq[sessionID])
	}
}

func TestHermesToolFirstKeepsInitialAnswerIDForPostToolText(t *testing.T) {
	service := NewHermesAgentService()
	sessionID := "quka-hermes-test"
	answerID := "hermes-answer-existing"

	service.activeTurns[sessionID] = &activeTurn{MessageID: answerID}
	service.messageSeq[sessionID] = 1

	service.handleGatewayEvent(gatewayEvent{
		Type:      "tool.start",
		SessionID: sessionID,
		Payload:   []byte(`{"id":"tool-1","name":"web"}`),
	})
	if service.activeTurns[sessionID].NeedsNewSegment {
		t.Fatal("tool-first turn should not split before any assistant segment is initialized")
	}

	service.handleGatewayEvent(gatewayEvent{
		Type:      "message.delta",
		SessionID: sessionID,
		Payload:   []byte(`{"text":"After tool."}`),
	})
	turn := service.activeTurns[sessionID]
	if turn.MessageID != answerID {
		t.Fatalf("tool-first assistant id = %q, want %q", turn.MessageID, answerID)
	}
	if turn.Text != "After tool." {
		t.Fatalf("tool-first assistant text = %q", turn.Text)
	}
}

func TestPrepareHermesProcessHomeIsolatesDotHermes(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink target assertion is unix-specific")
	}
	home := t.TempDir()

	processHome, err := prepareHermesProcessHome(home)
	if err != nil {
		t.Fatal(err)
	}
	if processHome != filepath.Join(home, "process-home") {
		t.Fatalf("processHome = %q", processHome)
	}
	target, err := os.Readlink(filepath.Join(processHome, ".hermes"))
	if err != nil {
		t.Fatal(err)
	}
	if target != home {
		t.Fatalf("isolated .hermes target = %q, want %q", target, home)
	}
}

func TestHermesDesktopSessionStorePersistsHistory(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	service := NewHermesAgentService()
	service.mu.Lock()
	if err := service.ensureStoreLoadedLocked(); err != nil {
		service.mu.Unlock()
		t.Fatal(err)
	}
	service.sessions["session-1"] = &HermesSession{
		ID:               "session-1",
		Title:            "Persisted",
		SpaceID:          "space-1",
		LatestAccessTime: 123,
	}
	service.histories["session-1"] = []HermesMessageDetail{
		{
			Meta: HermesMessageMeta{
				MessageID:   "msg-1",
				Sequence:    1,
				SendTime:    123,
				Role:        1,
				SessionID:   "session-1",
				Complete:    1,
				MessageType: 1,
				Message:     map[string]any{"text": "hello"},
				Attach:      []any{},
			},
			Ext: HermesMessageExt{RelDocs: []any{}},
		},
	}
	service.messageSeq["session-1"] = 1
	if err := service.saveStoreLocked(); err != nil {
		service.mu.Unlock()
		t.Fatal(err)
	}
	service.mu.Unlock()

	next := NewHermesAgentService()
	list, err := next.ListSessions("space-1", 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	if list.Total != 1 || list.List[0].ID != "session-1" {
		t.Fatalf("unexpected session list: %+v", list)
	}
	history, err := next.GetSessionHistory("space-1", "session-1", 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	if history.Total != 1 || stringValue(history.List[0].Meta.Message["text"]) != "hello" {
		t.Fatalf("unexpected history: %+v", history)
	}
}

func TestRecordToolMessagePersistsToolTipsDetails(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	service := NewHermesAgentService()
	service.recordToolMessage("session-1", "tool-1", "quka-ai", 2, "Completed", true, map[string]any{
		"id":             "tool-1",
		"tool_name":      "quka-ai",
		"status":         2,
		"content":        "Completed",
		"arguments":      map[string]any{"query": "pricing docs"},
		"arguments_text": "{\n  \"query\": \"pricing docs\"\n}",
		"result":         map[string]any{"ok": true},
		"result_text":    "{\n  \"ok\": true\n}",
	})

	next := NewHermesAgentService()
	history, err := next.GetSessionHistory("", "session-1", 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	if history.Total != 1 {
		t.Fatalf("history total = %d", history.Total)
	}
	ext := history.List[0].Ext
	if ext.ToolName != "quka-ai" {
		t.Fatalf("tool_name = %q", ext.ToolName)
	}
	if !strings.Contains(ext.ToolArgs, "pricing docs") {
		t.Fatalf("tool_args = %q", ext.ToolArgs)
	}
	if len(ext.ToolTips) != 1 {
		t.Fatalf("tool_tips length = %d", len(ext.ToolTips))
	}
	if stringValue(ext.ToolTips[0]["result_text"]) == "" {
		t.Fatalf("tool_tips result_text missing: %+v", ext.ToolTips[0])
	}
}

func TestQukaAgentToolStartCreatesAgentRunInsteadOfToolMessage(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	service := NewHermesAgentService()
	sessionID := "session-1"
	service.activeTurns[sessionID] = &activeTurn{MessageID: "answer-1", Initialized: true}
	request := `{"user_request":"Check milestones","nodes":[{"node_id":"github","agent_id":"github-agent","title":"GitHub Agent","task":"Read milestones"}]}`
	command := `python3 "/tmp/quka_agents.py" run-agents --request-json '` + request + `'`

	if !service.handleAgentToolStart(gatewayEvent{
		Type:      "tool.start",
		SessionID: sessionID,
		Payload:   []byte(`{"id":"tool-1","name":"terminal","arguments":{"command":` + strconv.Quote(command) + `}}`),
	}) {
		t.Fatal("quka agent tool start was not intercepted")
	}
	if !service.activeTurns[sessionID].NeedsNewSegment {
		t.Fatal("quka agent tool start did not mark assistant boundary")
	}

	history, err := service.GetSessionHistory("", sessionID, 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	if history.Total != 1 {
		t.Fatalf("history total = %d, want 1", history.Total)
	}
	item := history.List[0]
	if item.Meta.Role != 5 {
		t.Fatalf("role = %d, want agent role 5", item.Meta.Role)
	}
	if item.Ext.ToolName != "" || len(item.Ext.ToolTips) != 0 {
		t.Fatalf("sub agent was persisted as tool metadata: %+v", item.Ext)
	}
	if got := stringValue(item.Ext.AgentRun["status"]); got != "running" {
		t.Fatalf("agent status = %q, want running", got)
	}
}

func TestQukaAgentUpdateAppendsRealtimeEvents(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	service := NewHermesAgentService()
	sessionID := "session-1"
	request := `{"user_request":"Check milestones","nodes":[{"node_id":"github","agent_id":"github-agent","title":"GitHub Agent","task":"Read milestones"}]}`
	command := `python3 "/tmp/quka_agents.py" run-agents --request-json '` + request + `'`

	service.handleAgentToolStart(gatewayEvent{
		Type:      "tool.start",
		SessionID: sessionID,
		Payload:   []byte(`{"id":"tool-1","name":"terminal","arguments":{"command":` + strconv.Quote(command) + `}}`),
	})
	service.handleAgentRunUpdate(gatewayEvent{
		Type:      "agent.update",
		SessionID: sessionID,
		Payload: []byte(`{
			"run_id":"agent-run-actual",
			"node_id":"github",
			"agent_id":"github-agent",
			"title":"GitHub Agent",
			"status":"running",
			"event":{"type":"delta","text":"checking milestones","time":"2026-06-08T00:00:00Z"}
		}`),
	})
	service.handleAgentRunUpdate(gatewayEvent{
		Type:      "agent.update",
		SessionID: sessionID,
		Payload: []byte(`{
			"run_id":"agent-run-actual",
			"node_id":"github",
			"event":{"type":"tool.start","id":"gh","name":"terminal","arguments":{"command":"gh issue list"}}
		}`),
	})

	history, err := service.GetSessionHistory("", sessionID, 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	if history.Total != 1 {
		t.Fatalf("history total = %d, want 1", history.Total)
	}
	item := history.List[0]
	if got := stringValue(item.Ext.AgentRun["status"]); got != "running" {
		t.Fatalf("agent status = %q, want running", got)
	}
	events, ok := item.Ext.AgentRun["events"].([]any)
	if !ok {
		t.Fatalf("agent events type = %T", item.Ext.AgentRun["events"])
	}
	if len(events) != 2 {
		t.Fatalf("agent events len = %d, want 2: %#v", len(events), events)
	}
	first, _ := events[0].(map[string]any)
	if stringValue(first["text"]) != "checking milestones" {
		t.Fatalf("first event = %#v", first)
	}
	second, _ := events[1].(map[string]any)
	if stringValue(second["name"]) != "terminal" {
		t.Fatalf("second event = %#v", second)
	}
}

func TestParseQukaAgentsRequestFromCommandHandlesQuotedJSONContent(t *testing.T) {
	command := `python3 "/tmp/quka_agents.py" run-agents --request-json '{"user_request":"Bob's milestone check","nodes":[{"node_id":"github","agent_id":"githuber","task":"Find {open} issues"}]}'`

	request, err := parseQukaAgentsRequestFromCommand(command)
	if err != nil {
		t.Fatal(err)
	}
	if got := stringValue(request["user_request"]); got != "Bob's milestone check" {
		t.Fatalf("user_request = %q", got)
	}
	nodes, ok := request["nodes"].([]any)
	if !ok || len(nodes) != 1 {
		t.Fatalf("nodes = %#v", request["nodes"])
	}
	node, ok := nodes[0].(map[string]any)
	if !ok || stringValue(node["task"]) != "Find {open} issues" {
		t.Fatalf("node = %#v", nodes[0])
	}
}

func TestQukaAgentToolCompleteUsesCachedCommand(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	service := NewHermesAgentService()
	sessionID := "session-1"
	request := `{"user_request":"Check milestones","nodes":[{"node_id":"github","agent_id":"github-agent","title":"GitHub Agent","task":"Read milestones"}]}`
	command := `python3 "/tmp/quka_agents.py" run-agents --request-json '` + request + `'`

	service.handleAgentToolStart(gatewayEvent{
		Type:      "tool.start",
		SessionID: sessionID,
		Payload:   []byte(`{"id":"tool-1","name":"terminal","arguments":{"command":` + strconv.Quote(command) + `}}`),
	})
	result := `{"ok":true,"run_id":"agent-run-actual","nodes":[{"node_id":"github","agent_id":"github-agent","title":"GitHub Agent","status":"completed","result":"done"}]}`
	if !service.handleAgentToolComplete(gatewayEvent{
		Type:      "tool.complete",
		SessionID: sessionID,
		Payload:   []byte(`{"id":"tool-1","name":"terminal","result":` + strconv.Quote(result) + `}`),
	}) {
		t.Fatal("quka agent tool complete was not intercepted from cached command")
	}

	history, err := service.GetSessionHistory("", sessionID, 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	if history.Total != 1 {
		t.Fatalf("history total = %d, want 1", history.Total)
	}
	item := history.List[0]
	if item.Meta.Role != 5 {
		t.Fatalf("role = %d, want agent role 5", item.Meta.Role)
	}
	if item.Meta.Complete != 1 {
		t.Fatalf("complete = %d, want success", item.Meta.Complete)
	}
	if got := stringValue(item.Ext.AgentRun["status"]); got != "completed" {
		t.Fatalf("agent status = %q, want completed", got)
	}
	if _, ok := service.agentTools[agentToolKey(sessionID, "tool-1")]; ok {
		t.Fatal("agent tool cache was not cleared")
	}
}

func TestQukaAgentToolTimeoutKeepsRunningUntilFinalAgentUpdate(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	service := NewHermesAgentService()
	sessionID := "session-1"
	request := `{"user_request":"Check milestones","nodes":[{"node_id":"github","agent_id":"github-agent","title":"GitHub Agent","task":"Read milestones"}]}`
	command := `python3 "/tmp/quka_agents.py" run-agents --request-json '` + request + `'`

	service.handleAgentToolStart(gatewayEvent{
		Type:      "tool.start",
		SessionID: sessionID,
		Payload:   []byte(`{"id":"tool-1","name":"terminal","arguments":{"command":` + strconv.Quote(command) + `}}`),
	})
	timeoutResult := `{"status":"timeout","output":"","timeout_note":"Waited 120s, process still running"}`
	if !service.handleAgentToolComplete(gatewayEvent{
		Type:      "tool.complete",
		SessionID: sessionID,
		Payload:   []byte(`{"id":"tool-1","name":"terminal","result":` + strconv.Quote(timeoutResult) + `}`),
	}) {
		t.Fatal("quka agent timeout complete was not intercepted")
	}

	history, err := service.GetSessionHistory("", sessionID, 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	if history.Total != 1 {
		t.Fatalf("history total after timeout = %d, want 1", history.Total)
	}
	item := history.List[0]
	if got := stringValue(item.Ext.AgentRun["status"]); got != "running" {
		t.Fatalf("agent status after timeout = %q, want running", got)
	}
	if item.Meta.Complete != 0 {
		t.Fatalf("complete after timeout = %d, want running", item.Meta.Complete)
	}

	service.handleAgentRunUpdate(gatewayEvent{
		Type:      "agent.update",
		SessionID: sessionID,
		Payload: []byte(`{
			"run_id":"agent-run-actual",
			"node_id":"github",
			"agent_id":"github-agent",
			"title":"GitHub Agent",
			"status":"completed",
			"result":"done"
		}`),
	})

	history, err = service.GetSessionHistory("", sessionID, 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	if history.Total != 1 {
		t.Fatalf("history total after final update = %d, want 1", history.Total)
	}
	item = history.List[0]
	if item.Meta.Complete != 1 {
		t.Fatalf("complete after final update = %d, want completed", item.Meta.Complete)
	}
	if got := stringValue(item.Ext.AgentRun["status"]); got != "completed" {
		t.Fatalf("agent status after final update = %q, want completed", got)
	}
	if got := stringValue(item.Ext.AgentRun["actual_run_id"]); got != "agent-run-actual" {
		t.Fatalf("actual_run_id = %q, want agent-run-actual", got)
	}
}

func TestQukaAgentParseFallbackDoesNotOverwriteFinalResult(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	service := NewHermesAgentService()
	sessionID := "session-1"
	request := `{"user_request":"Check milestones","nodes":[{"node_id":"github","agent_id":"github-agent","title":"GitHub Agent","task":"Read milestones"}]}`
	command := `python3 "/tmp/quka_agents.py" run-agents --request-json '` + request + `'`

	service.handleAgentToolStart(gatewayEvent{
		Type:      "tool.start",
		SessionID: sessionID,
		Payload:   []byte(`{"id":"tool-1","name":"terminal","arguments":{"command":` + strconv.Quote(command) + `}}`),
	})
	service.handleAgentRunUpdate(gatewayEvent{
		Type:      "agent.update",
		SessionID: sessionID,
		Payload: []byte(`{
			"run_id":"agent-run-actual",
			"node_id":"github",
			"agent_id":"github-agent",
			"title":"GitHub Agent",
			"status":"completed",
			"result":"final sub agent result",
			"event":{"type":"delta","text":"working details"}
		}`),
	})
	if !service.handleAgentToolComplete(gatewayEvent{
		Type:      "tool.complete",
		SessionID: sessionID,
		Payload:   []byte(`{"id":"tool-1","name":"terminal","result":"{\"ok\": true, \"nodes\": [{\"result\": \"bad\njson\"}]}"} `),
	}) {
		t.Fatal("quka agent parse-failed complete was not intercepted")
	}

	history, err := service.GetSessionHistory("", sessionID, 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	if history.Total != 1 {
		t.Fatalf("history total = %d, want 1", history.Total)
	}
	item := history.List[0]
	if got := stringValue(item.Ext.AgentRun["result"]); got != "final sub agent result" {
		t.Fatalf("result was overwritten = %q", got)
	}
	if got := stringValue(item.Ext.AgentRun["warning"]); strings.Contains(got, "could not parse") {
		t.Fatalf("parse fallback warning overwrote final run: %q", got)
	}
	events := agentRunEvents(item.Ext.AgentRun["events"])
	if len(events) != 1 {
		t.Fatalf("events len = %d, want 1: %#v", len(events), events)
	}
}

func TestFinalAgentUpdateMarksAgentRunComplete(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	service := NewHermesAgentService()
	sessionID := "session-1"

	service.handleAgentRunUpdate(gatewayEvent{
		Type:      "agent.update",
		SessionID: sessionID,
		Payload: []byte(`{
			"run_id":"agent-run-actual",
			"node_id":"github",
			"agent_id":"github-agent",
			"title":"GitHub Agent",
			"status":"completed",
			"result":"done"
		}`),
	})

	history, err := service.GetSessionHistory("", sessionID, 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	if history.Total != 1 {
		t.Fatalf("history total = %d, want 1", history.Total)
	}
	item := history.List[0]
	if item.Meta.Complete != 1 {
		t.Fatalf("complete = %d, want completed", item.Meta.Complete)
	}
	if got := stringValue(item.Ext.AgentRun["status"]); got != "completed" {
		t.Fatalf("agent status = %q, want completed", got)
	}
}

func TestQukaAgentToolStartDoesNotCreateCoordinatorPlaceholder(t *testing.T) {
	home := t.TempDir()
	t.Setenv("QUKA_HERMES_HOME", home)

	service := NewHermesAgentService()
	sessionID := "session-1"
	command := `python3 "/tmp/quka_agents.py" run-agents --request-file /tmp/not-created-yet.json`

	if !service.handleAgentToolStart(gatewayEvent{
		Type:      "tool.start",
		SessionID: sessionID,
		Payload:   []byte(`{"id":"tool-1","name":"terminal","arguments":{"command":` + strconv.Quote(command) + `}}`),
	}) {
		t.Fatal("quka agent tool start was not intercepted")
	}

	history, err := service.GetSessionHistory("", sessionID, 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	if history.Total != 0 {
		t.Fatalf("history total = %d, want no synthetic coordinator placeholder", history.Total)
	}
}

func TestParseQukaAgentsResultFromNestedTerminalOutput(t *testing.T) {
	runResult := map[string]any{
		"ok":        true,
		"run_id":    "agent-run-123",
		"status":    "completed",
		"trace_dir": "/tmp/agent-run-123",
		"nodes": []map[string]any{
			{
				"node_id":  "create_reminder",
				"agent_id": "adidas",
				"title":    "穿Adi的Agent",
				"status":   "completed",
				"result":   "done",
			},
		},
	}
	runRaw, err := json.MarshalIndent(runResult, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	terminalResult, err := json.Marshal(map[string]any{"output": string(runRaw), "exit_code": 0, "error": nil})
	if err != nil {
		t.Fatal(err)
	}
	payload, err := json.Marshal(map[string]any{"result": string(terminalResult)})
	if err != nil {
		t.Fatal(err)
	}

	parsed, err := parseQukaAgentsResultFromPayload(payload)
	if err != nil {
		t.Fatal(err)
	}
	if parsed["run_id"] != "agent-run-123" {
		t.Fatalf("run_id = %v", parsed["run_id"])
	}
	nodes, ok := parsed["nodes"].([]any)
	if !ok || len(nodes) != 1 {
		t.Fatalf("nodes = %#v", parsed["nodes"])
	}
	node, ok := nodes[0].(map[string]any)
	if !ok || node["title"] != "穿Adi的Agent" {
		t.Fatalf("node = %#v", nodes[0])
	}
}
