NAME := MirrorBlock
VERSION != jq .version src/manifest.json

.PHONY: default
default:
	@echo "$(NAME) $(VERSION)"
	@echo 'usage:'
	@echo '* make build: build extension'
	@echo '* make clean: clean extension dir'
	@echo '* make zip: compress extension into zip file'
	@echo '* make srczip: compress extension source into zip file (for upload to addons.mozilla.org)'
	@echo 'requirements: node, typescript'

.PHONY: build
build:
	mkdir -p build/
	cp -r src/. build/
	yarn webpack

.PHONY: clean
clean:
	rm -rf build/ dist/

.PHONY: addon-lint
addon-lint:
	addons-linter ./build -o json | jq '{errors}'

.PHONY: zip
zip:
	mkdir -p dist/
	fd --type f -e ts . build/ --exec rm
	cd build && zip -9 -X -r ../dist/$(NAME)-v$(VERSION).zip .
	make addon-lint

.PHONY: srczip
srczip:
	git archive -9 -v -o ./dist/$(NAME)-v$(VERSION).Source.zip HEAD

