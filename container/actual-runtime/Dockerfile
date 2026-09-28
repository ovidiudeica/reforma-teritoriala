ARG BASE_IMAGE=node:24.21.0-bookworm
FROM ${BASE_IMAGE}

ARG ACTUAL_RUNTIME_BASE_DIGEST
ENV NODE_ENV=production
LABEL org.opencontainers.image.title="Reforma ACTUAL runtime" \
      org.opencontainers.image.description="Pinned runtime for deterministic ACTUAL builds" \
      io.reforma.actual.node="24.21.0" \
      io.reforma.actual.npm="11.19.0" \
      io.reforma.actual.base-digest="${ACTUAL_RUNTIME_BASE_DIGEST}"

RUN test "$(node --version)" = "v24.21.0" \
 && test "$(npm --version)" = "11.19.0" \
 && git --version \
 && bash --version >/dev/null

WORKDIR /workspace
