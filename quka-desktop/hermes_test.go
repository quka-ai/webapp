package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
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
