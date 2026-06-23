# App icons & splash

This boilerplate ships **without** branded image assets so a fork starts clean.
Add your own here, then wire them up in `app.json`.

## Recommended files

| File | Size | Purpose |
|---|---|---|
| `icon.png` | 1024×1024 | App icon (iOS + base) |
| `splash-icon.png` | ~1024×1024 (transparent) | Splash screen logo |
| `adaptive-icon.png` | 1024×1024 (safe zone ~66%) | Android adaptive foreground |
| `favicon.png` | 48×48 | Web favicon |

## Enable them in `app.json`

Once the files exist, add the following keys under `expo`:

```jsonc
{
  "expo": {
    "icon": "./assets/images/icon.png",
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#ffffff",
        "foregroundImage": "./assets/images/adaptive-icon.png"
      }
    },
    "web": {
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": { "backgroundColor": "#000000" }
        }
      ]
    ]
  }
}
```

> Tip: `npx expo-doctor` will flag any asset paths in `app.json` that point to
> missing files.
