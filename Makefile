##############################################################################
# Makefile  --  Photobook (Vite SPA + Node narration/translation server)
# make build / make all / make helm-package / make bump-patch
##############################################################################

APP_NAME  := photobook
HELM_NAME := photobook

AWS_ACCOUNT   := 096016688168
AWS_REGION    := us-east-1
ECR_HOST      := $(AWS_ACCOUNT).dkr.ecr.$(AWS_REGION).amazonaws.com
ECR_NAMESPACE := sncr/bda/ml
ECR_REPO_REL  := $(ECR_HOST)/$(ECR_NAMESPACE)/$(APP_NAME)-releases
ECR_REPO_SNAP := $(ECR_HOST)/$(ECR_NAMESPACE)/$(APP_NAME)-snapshots

RELEASE_FILE      := .release_number
HELM_RELEASE_FILE := .helm_release_number

APP_VERSION  := $(shell cat $(RELEASE_FILE)      2>/dev/null || echo "1.0.0")
HELM_VERSION := $(shell cat $(HELM_RELEASE_FILE) 2>/dev/null || echo "1.0.0")
GIT_SHORT    := $(shell git rev-parse --short HEAD 2>/dev/null || echo "nogit")

IS_RELEASE := $(shell git tag --points-at HEAD 2>/dev/null | grep -q "^v" && echo "yes" || echo "no")
ifeq ($(IS_RELEASE),yes)
  ECR_REPO  := $(ECR_REPO_REL)
  IMAGE_TAG := $(APP_VERSION)
else
  ECR_REPO  := $(ECR_REPO_SNAP)
  IMAGE_TAG := snapshot-$(APP_VERSION)-$(GIT_SHORT)
endif

LOCAL_IMAGE  := $(APP_NAME):$(IMAGE_TAG)
REMOTE_IMAGE := $(ECR_REPO):$(IMAGE_TAG)
LATEST_IMAGE := $(ECR_REPO):latest

# Optional: bake the photobook API endpoint/key into the client bundle at build
# time. Leave empty to use the defaults in src/config.js.
VITE_PHOTOBOOK_API_URL ?=
VITE_PHOTOBOOK_API_KEY ?=

docker=docker
awscli=$(HOME)/bin/aws

HELM_CHART_DIR := deployment/helm/$(HELM_NAME)
HELM_PKG_DIR   := deployment/helm/packages
HELM_PKG_FILE  := $(HELM_PKG_DIR)/$(HELM_NAME)-$(HELM_VERSION).tgz
HELM_OCI_URI   := oci://$(ECR_HOST)/$(ECR_NAMESPACE)/helm

##############################################################################
.PHONY: all all_ecr all_helm build tag-ecr push-ecr push-latest ship \
        helm-package helm-push ecr-login \
        bump bump-patch bump-minor bump-helm-patch bump-helm-minor \
        show-config clean

.EXPORT_ALL_VARIABLES:
LW_ACCOUNT_NAME = $(bamboo.LW_ACCOUNT_NAME)
LW_ACCESS_TOKEN_PASSWORD = $(bamboo.LW_ACCESS_TOKEN_PASSWORD)
AWS_ACCESS_KEY_ID = ${bamboo_AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY = ${bamboo_AWS_SECRET_ACCESS_KEY}

all: build tag-ecr push-ecr helm-package helm-push
all_ecr:  build tag-ecr push-ecr
all_helm: helm-package helm-push

build:
	@echo "==> Building $(LOCAL_IMAGE)"
	$(docker) build \
	   --build-arg APP_VERSION=$(APP_VERSION) \
	   --build-arg VITE_PHOTOBOOK_API_URL=$(VITE_PHOTOBOOK_API_URL) \
	   --build-arg VITE_PHOTOBOOK_API_KEY=$(VITE_PHOTOBOOK_API_KEY) \
	   -t $(LOCAL_IMAGE) \
	   -f Dockerfile .

tag-ecr:
	@echo "==> Tagging $(LOCAL_IMAGE) -> $(REMOTE_IMAGE)"
	$(docker) tag $(LOCAL_IMAGE) $(REMOTE_IMAGE)

push-ecr: ecr-login tag-ecr
	@echo "==> Pushing $(REMOTE_IMAGE)"
	$(docker) --context rootless --config $${bamboo_build_working_directory}/.docker push $(REMOTE_IMAGE)

# Also publish a mutable :latest so deploys don't need a per-build tag. Pair with
# image.pullPolicy=Always (values-prod) + `kubectl rollout restart` to pull it.
push-latest: ecr-login
	@echo "==> Tagging + pushing $(LATEST_IMAGE)"
	$(docker) tag $(LOCAL_IMAGE) $(LATEST_IMAGE)
	$(docker) --context rootless --config $${bamboo_build_working_directory}/.docker push $(LATEST_IMAGE)

# One-shot: build + push the immutable sha tag (for rollback) AND :latest.
ship: build push-ecr push-latest
	@echo "==> Shipped $(REMOTE_IMAGE) and $(LATEST_IMAGE)"

ecr-login:
	@echo "==> Logging in to ECR ($(ECR_HOST))"
	$(awscli) --version && \
	$(docker) --config $${bamboo_build_working_directory}/.docker context create rootless \
	    --docker "host=unix:///run/user/$$(id -u)/docker.sock" || true && \
	$(awscli) ecr get-login-password --region $(AWS_REGION) | \
	    $(docker) --context rootless --config $${bamboo_build_working_directory}/.docker login \
	    --username AWS --password-stdin $(ECR_HOST)

helm-package:
	@mkdir -p $(HELM_PKG_DIR)
	@echo "==> Packaging Helm chart $(HELM_NAME) v$(HELM_VERSION)"
	helm package $(HELM_CHART_DIR) \
	   --version $(HELM_VERSION) \
	   --app-version $(APP_VERSION) \
	   --destination $(HELM_PKG_DIR)

helm-push: ecr-login helm-package
	@echo "==> Pushing Helm chart -> $(HELM_OCI_URI)"
	helm push $(HELM_PKG_FILE) $(HELM_OCI_URI)

_read_semver = $(word 1,$(subst ., ,$1)) $(word 2,$(subst ., ,$1)) $(word 3,$(subst ., ,$1))

bump:
	@echo "App version  : $(APP_VERSION)  ($(RELEASE_FILE))"
	@echo "Helm version : $(HELM_VERSION)  ($(HELM_RELEASE_FILE))"

bump-patch:
	$(eval _MAJ := $(word 1,$(call _read_semver,$(APP_VERSION))))
	$(eval _MIN := $(word 2,$(call _read_semver,$(APP_VERSION))))
	$(eval _PAT := $(word 3,$(call _read_semver,$(APP_VERSION))))
	$(eval _NEW := $(_MAJ).$(_MIN).$(shell echo $$(($(_PAT)+1))))
	@echo "$(_NEW)" > $(RELEASE_FILE)
	@echo "==> App version bumped: $(APP_VERSION) -> $(_NEW)"

bump-minor:
	$(eval _MAJ := $(word 1,$(call _read_semver,$(APP_VERSION))))
	$(eval _MIN := $(word 2,$(call _read_semver,$(APP_VERSION))))
	$(eval _NEW := $(_MAJ).$(shell echo $$(($(_MIN)+1))).0)
	@echo "$(_NEW)" > $(RELEASE_FILE)
	@echo "==> App version bumped: $(APP_VERSION) -> $(_NEW)"

bump-helm-patch:
	$(eval _MAJ := $(word 1,$(call _read_semver,$(HELM_VERSION))))
	$(eval _MIN := $(word 2,$(call _read_semver,$(HELM_VERSION))))
	$(eval _PAT := $(word 3,$(call _read_semver,$(HELM_VERSION))))
	$(eval _NEW := $(_MAJ).$(_MIN).$(shell echo $$(($(_PAT)+1))))
	@echo "$(_NEW)" > $(HELM_RELEASE_FILE)
	@echo "==> Helm version bumped: $(HELM_VERSION) -> $(_NEW)"
	@sed -i.bak "s/^version:.*/version: $(_NEW)/" $(HELM_CHART_DIR)/Chart.yaml && \
	   rm -f $(HELM_CHART_DIR)/Chart.yaml.bak

bump-helm-minor:
	$(eval _MAJ := $(word 1,$(call _read_semver,$(HELM_VERSION))))
	$(eval _MIN := $(word 2,$(call _read_semver,$(HELM_VERSION))))
	$(eval _NEW := $(_MAJ).$(shell echo $$(($(_MIN)+1))).0)
	@echo "$(_NEW)" > $(HELM_RELEASE_FILE)
	@echo "==> Helm version bumped: $(HELM_VERSION) -> $(_NEW)"
	@sed -i.bak "s/^version:.*/version: $(_NEW)/" $(HELM_CHART_DIR)/Chart.yaml && \
	   rm -f $(HELM_CHART_DIR)/Chart.yaml.bak

show-config:
	@echo "APP_NAME     : $(APP_NAME)"
	@echo "APP_VERSION  : $(APP_VERSION)"
	@echo "HELM_VERSION : $(HELM_VERSION)"
	@echo "GIT_SHORT    : $(GIT_SHORT)"
	@echo "IS_RELEASE   : $(IS_RELEASE)"
	@echo "LOCAL_IMAGE  : $(LOCAL_IMAGE)"
	@echo "REMOTE_IMAGE : $(REMOTE_IMAGE)"
	@echo "HELM_OCI_URI : $(HELM_OCI_URI)"
	@echo "HELM_PKG     : $(HELM_PKG_FILE)"

clean:
	@rm -rf $(HELM_PKG_DIR)/*.tgz
	@echo "==> Cleaned packaged Helm charts"
