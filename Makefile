.PHONY: deploy build

underline=`tput smul`
nounderline=`tput rmul`
bold=`tput bold`
normal=`tput sgr0`

deploy:
	@npm run -s deploy

build:
	@npm run -s build
