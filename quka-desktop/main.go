package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application menu with keyboard shortcuts
	appMenu := menu.NewMenu()

	// App menu (QukaAI)
	appMenu.Append(menu.AppMenu())

	// Edit menu - use the built-in EditMenu() for proper system integration
	appMenu.Append(menu.EditMenu())

	// Window menu with Close Window shortcut
	windowMenu := appMenu.AddSubmenu("Window")
	windowMenu.AddText("Minimize", keys.CmdOrCtrl("m"), func(_ *menu.CallbackData) {
		runtime.WindowMinimise(app.ctx)
	})
	windowMenu.AddText("Close Window", keys.CmdOrCtrl("w"), func(_ *menu.CallbackData) {
		runtime.Hide(app.ctx)
	})
	windowMenu.AddSeparator()
	windowMenu.AddText("Bring All to Front", keys.CmdOrCtrl(""), func(_ *menu.CallbackData) {
		runtime.Show(app.ctx)
	})

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "QukaAI",
		Width:  1640,
		Height: 1080,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		// OnBeforeClose:    app.beforeClose,
		Menu: appMenu,
		Bind: []interface{}{
			app,
		},
		Mac: &mac.Options{
			TitleBar: &mac.TitleBar{
				TitlebarAppearsTransparent: false,
				HideTitle:                  false,
				HideTitleBar:               false,
				FullSizeContent:            false,
				UseToolbar:                 false,
				HideToolbarSeparator:       true,
			},
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			About: &mac.AboutInfo{
				Title:   "QukaAI",
				Message: "© 2025 QukaAI",
			},
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
