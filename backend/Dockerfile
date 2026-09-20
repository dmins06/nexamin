FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN groupadd --system app && useradd --system --gid app --create-home app
WORKDIR /app
COPY pyproject.toml ./
COPY app ./app
RUN pip install --upgrade pip && pip install "."
COPY alembic.ini ./
COPY alembic ./alembic
COPY data ./data
COPY scripts ./scripts
RUN mkdir -p /app/media && chown -R app:app /app
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
