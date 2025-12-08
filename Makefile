# Makefile for pCloud Chrome Extension Packaging

# --- Configuration ---
# Uses manifest.json to determine version
VERSION := $(shell jq -r .version manifest.json)
EXTENSION_NAME := pcloud-chrome-extension

# Files/Folders to include in the package
# We include src, _locales, and manifest.json explicitly
# doc/ and other root files are excluded by not initiating them here
SRC_ITEMS := \
    manifest.json \
    _locales \
    src

# Development settings
DEV_ZIP_FILE = $(EXTENSION_NAME)-v$(VERSION)-dev.zip
DEV_BUILD_DIR = build-dev

# Production settings
PROD_ZIP_FILE = $(EXTENSION_NAME)-v$(VERSION).zip
PROD_BUILD_DIR = build-prod

# --- Targets ---

.DEFAULT_GOAL := package

# --- Development Targets ---
# Just copy files and zip, no minification
package: clean-dev build-dev zip-dev clean-dev
	@echo "✅ Development package created: $(DEV_ZIP_FILE)"

build-dev:
	@echo "📦 Creating development build..."
	@mkdir -p $(DEV_BUILD_DIR)
	@cp -R $(SRC_ITEMS) $(DEV_BUILD_DIR)/

zip-dev:
	@echo "🗜️  Zipping development package..."
	@cd $(DEV_BUILD_DIR) && zip -qr ../$(DEV_ZIP_FILE) .

# --- Production Targets ---
# Copy, Minify JS/CSS, then Zip
release: clean-prod build-prod minify-prod zip-prod clean-prod
	@echo "✅ Production package created: $(PROD_ZIP_FILE)"

build-prod:
	@echo "📦 Creating production build directory..."
	@mkdir -p $(PROD_BUILD_DIR)
	@cp -R $(SRC_ITEMS) $(PROD_BUILD_DIR)/

# Minify all JS and CSS files in the build directory in-place
# We use 'find' to locate all .js and .css files and run esbuild on them
# --allow-overwrite lets us replace the original file with the minified version
# avoiding the need to rename files and update manifest/imports
minify-prod:
	@echo "🔨 Minifying JS files..."
	@find $(PROD_BUILD_DIR) -name "*.js" -type f -exec sh -c 'npx esbuild "$$1" --minify --allow-overwrite --outfile="$$1"' _ {} \;
	@echo "🎨 Minifying CSS files..."
	@find $(PROD_BUILD_DIR) -name "*.css" -type f -exec sh -c 'npx esbuild "$$1" --minify --allow-overwrite --outfile="$$1"' _ {} \;

zip-prod:
	@echo "🗜️  Zipping production package..."
	@cd $(PROD_BUILD_DIR) && zip -qr ../$(PROD_ZIP_FILE) .

# --- Cleanup ---
clean: clean-dev clean-prod
	@echo "🧹 Removing all zip files..."
	@rm -f *.zip

clean-dev:
	@rm -rf $(DEV_BUILD_DIR)

clean-prod:
	@rm -rf $(PROD_BUILD_DIR)

.PHONY: package build-dev zip-dev release build-prod minify-prod zip-prod clean clean-dev clean-prod
