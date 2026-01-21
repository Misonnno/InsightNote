# InsightNote - AI Coding Agent Instructions

## Project Overview
InsightNote is a Python-based backend project (毕设项目 - graduation project) built with **FastAPI**. Currently in early stage with foundational API endpoints.

## Architecture & Key Patterns

### Stack
- **Framework**: FastAPI - lightweight async web framework
- **Language**: Python 3.7+
- **Current Structure**: Single `backend/main.py` entry point

### Project Structure
```
backend/
  └── main.py          # Main FastAPI application, all endpoints defined here
```

### API Patterns
- RESTful endpoints using FastAPI decorators (`@app.get()`, etc.)
- Simple response dict format: `{"key": "value"}`
- Current endpoints:
  - `GET /` - Root endpoint (greeting message)
  - `GET /ping` - Health check endpoint

## Development Workflows

### Running the Application
```bash
# Prerequisites: FastAPI installed (pip install fastapi uvicorn)
# Start server with uvicorn
uvicorn backend.main:app --reload
```

### Common Tasks
- **Adding new endpoints**: Define function with `@app.get()` or `@app.post()` decorator in `main.py`
- **Response format**: Return Python dict objects (FastAPI auto-converts to JSON)
- **Health checks**: Use the `/ping` endpoint to verify server is running

## Project Conventions

### Code Style
- Chinese comments and strings are acceptable (reflected in existing code: "毕设项目启动成功！🚀")
- Keep endpoint logic concise; refactor into separate modules when complexity grows

### Naming Conventions
- Function names: `snake_case` (e.g., `read_root`, `ping`)
- Endpoint paths: lowercase with hyphens if multi-word (e.g., `/api-version`)

### Integration Points
- No external databases configured yet
- No authentication/authorization layer implemented
- No logging framework visible - use Python's built-in `print()` or add `logging` module

## Next Steps for Expansion
- Create separate modules (e.g., `models/`, `routes/`) as endpoints grow
- Add dependency injection layer if shared logic emerges
- Implement error handling with FastAPI's `HTTPException`
- Document API with auto-generated OpenAPI schema at `/docs`

## References
- FastAPI Docs: https://fastapi.tiangolo.com
- OpenAPI docs auto-available at `/docs` when running server
