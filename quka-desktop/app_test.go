package main

import (
	"path/filepath"
	"runtime"
	"testing"
)

func TestLocalPathFromOpenRequestParsesFileURL(t *testing.T) {
	got, err := localPathFromOpenRequest(OpenLocalPathRequest{URL: "file:///Users/test/My%20Report.pdf"})
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Clean("/Users/test/My Report.pdf")
	if runtime.GOOS == "windows" {
		want = filepath.Clean("\\Users\\test\\My Report.pdf")
	}
	if got != want {
		t.Fatalf("path = %q, want %q", got, want)
	}
}

func TestLocalPathFromOpenRequestRejectsRemoteFileURL(t *testing.T) {
	if _, err := localPathFromOpenRequest(OpenLocalPathRequest{URL: "file://example.com/Users/test/report.pdf"}); err == nil {
		t.Fatal("expected remote file URL to be rejected")
	}
}

func TestLocalPathFromOpenRequestExpandsHomePath(t *testing.T) {
	got, err := localPathFromOpenRequest(OpenLocalPathRequest{Path: "~/Desktop/report.pdf"})
	if err != nil {
		t.Fatal(err)
	}
	if !filepath.IsAbs(got) {
		t.Fatalf("path should be absolute: %q", got)
	}
}
