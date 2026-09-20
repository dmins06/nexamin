FROM node:22-alpine AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN groupadd --system app && useradd --system --gid app --create-home app
WORKDIR /app
COPY backend/pyproject.toml ./
COPY backend/app ./app
RUN pip install --upgrade pip && pip install "."
COPY backend/alembic.ini ./
COPY backend/alembic ./alembic
COPY backend/data ./data
COPY backend/scripts ./scripts
COPY --from=frontend /build/dist ./frontend
RUN mkdir -p /app/media && chown -R app:app /app
USER app
EXPOSE 10000
CMD ["sh", "-c", "alembic upgrade head && python scripts/init_dev_db.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --proxy-headers"]
