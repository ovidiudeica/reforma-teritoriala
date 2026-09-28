ARG BASE_IMAGE=node:24.21.0-bookworm@sha256:64af3819f9275802414d7cdc38c27e9d82bd564dec4d4da87d008255d36c63b4
FROM ${BASE_IMAGE}

ARG ACTUAL_RUNTIME_BASE_DIGEST
ARG ACTUAL_RUNTIME_DOCKERFILE_SHA256

ENV NODE_ENV=production

LABEL org.opencontainers.image.title="Reforma ACTUAL runtime" \
      org.opencontainers.image.description="Pinned runtime for deterministic ACTUAL builds" \
      io.reforma.actual.node="24.21.0" \
      io.reforma.actual.npm="11.19.0" \
      io.reforma.actual.base-digest="${ACTUAL_RUNTIME_BASE_DIGEST}" \
      io.reforma.actual.dockerfile-sha256="${ACTUAL_RUNTIME_DOCKERFILE_SHA256}"

