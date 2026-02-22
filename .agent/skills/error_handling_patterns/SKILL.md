---
name: Error Handling Patterns
description: Patrones de manejo de errores multi-lenguaje incluyendo excepciones, tipos Result, propagación de errores y degradación elegante para construir aplicaciones resilientes.
---

# Error Handling Patterns

Construye aplicaciones resilientes con estrategias robustas de manejo de errores que gestionan fallos elegantemente y proporcionan excelentes experiencias de debugging.

## Cuándo Usar Esta Skill

- Implementando manejo de errores en nuevas funcionalidades
- Diseñando APIs resistentes a errores
- Debuggeando problemas en producción
- Mejorando la confiabilidad de aplicaciones
- Creando mejores mensajes de error para usuarios y desarrolladores
- Implementando patrones de retry y circuit breaker
- Manejando errores async/concurrentes
- Construyendo sistemas distribuidos tolerantes a fallos

## Conceptos Core

### 1. Filosofías de Manejo de Errores

**Excepciones vs Tipos Result:**

| Enfoque | Descripción | Cuándo Usar |
|---------|-------------|-------------|
| **Excepciones** | Try-catch tradicional, interrumpe flujo de control | Errores inesperados, condiciones excepcionales |
| **Result Types** | Éxito/fallo explícito, enfoque funcional | Errores esperados, fallos de validación |
| **Error Codes** | Estilo C, requiere disciplina | Sistemas legacy, interoperabilidad |
| **Option/Maybe** | Para valores nulables | Valores opcionales, búsquedas |
| **Panics/Crashes** | Terminación inmediata | Errores irrecuperables, bugs de programación |

### 2. Categorías de Errores

**Errores Recuperables:**
- Timeouts de red
- Archivos faltantes
- Input de usuario inválido
- Rate limits de API

**Errores Irrecuperables:**
- Out of memory
- Stack overflow
- Bugs de programación (null pointer, etc.)

---

## Patrones por Lenguaje

### Python

**Jerarquía de Excepciones Custom:**

```python
class ApplicationError(Exception):
    """Base exception for all application errors."""
    def __init__(self, message: str, code: str = None, details: dict = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}
        self.timestamp = datetime.utcnow()

class ValidationError(ApplicationError):
    """Raised when validation fails."""
    pass

class NotFoundError(ApplicationError):
    """Raised when resource not found."""
    pass

class ExternalServiceError(ApplicationError):
    """Raised when external service fails."""
    def __init__(self, message: str, service: str, **kwargs):
        super().__init__(message, **kwargs)
        self.service = service

# Uso
def get_user(user_id: str) -> User:
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise NotFoundError(
            f"User not found",
            code="USER_NOT_FOUND",
            details={"user_id": user_id}
        )
    return user
```

**Context Managers para Cleanup:**

```python
from contextlib import contextmanager

@contextmanager
def database_transaction(session):
    """Ensure transaction is committed or rolled back."""
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        raise
    finally:
        session.close()

# Uso
with database_transaction(db.session) as session:
    user = User(name="Alice")
    session.add(user)
    # Commit o rollback automático
```

**Retry con Exponential Backoff:**

```python
import time
from functools import wraps
from typing import TypeVar, Callable

T = TypeVar('T')

def retry(
    max_attempts: int = 3,
    backoff_factor: float = 2.0,
    exceptions: tuple = (Exception,)
):
    """Retry decorator with exponential backoff."""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            last_exception = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        sleep_time = backoff_factor ** attempt
                        time.sleep(sleep_time)
                        continue
                    raise
            raise last_exception
        return wrapper
    return decorator

# Uso
@retry(max_attempts=3, exceptions=(NetworkError,))
def fetch_data(url: str) -> dict:
    response = requests.get(url, timeout=5)
    response.raise_for_status()
    return response.json()
```

---

### TypeScript/JavaScript

**Clases de Error Custom:**

```typescript
class ApplicationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends ApplicationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

class NotFoundError extends ApplicationError {
  constructor(resource: string, id: string) {
    super(`${resource} not found`, "NOT_FOUND", 404, { resource, id });
  }
}

// Uso
function getUser(id: string): User {
  const user = users.find((u) => u.id === id);
  if (!user) {
    throw new NotFoundError("User", id);
  }
  return user;
}
```

**Patrón Result Type:**

```typescript
// Result type para manejo explícito de errores
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

// Funciones helper
function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// Uso
function parseJSON<T>(json: string): Result<T, SyntaxError> {
  try {
    const value = JSON.parse(json) as T;
    return Ok(value);
  } catch (error) {
    return Err(error as SyntaxError);
  }
}

// Consumiendo Result
const result = parseJSON<User>(userJson);
if (result.ok) {
  console.log(result.value.name);
} else {
  console.error("Parse failed:", result.error.message);
}
```

**Manejo de Errores Async:**

```typescript
async function fetchUserOrders(userId: string): Promise<Order[]> {
  try {
    const user = await getUser(userId);
    const orders = await getOrders(user.id);
    return orders;
  } catch (error) {
    if (error instanceof NotFoundError) {
      return []; // Return empty para not found
    }
    if (error instanceof NetworkError) {
      return retryFetchOrders(userId);
    }
    throw error; // Re-throw errores inesperados
  }
}
```

---

### Go

**Returns de Error Explícitos:**

```go
// Manejo básico de errores
func getUser(id string) (*User, error) {
    user, err := db.QueryUser(id)
    if err != nil {
        return nil, fmt.Errorf("failed to query user: %w", err)
    }
    if user == nil {
        return nil, errors.New("user not found")
    }
    return user, nil
}

// Tipos de error custom
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed for %s: %s", e.Field, e.Message)
}

// Errores sentinel para comparación
var (
    ErrNotFound     = errors.New("not found")
    ErrUnauthorized = errors.New("unauthorized")
    ErrInvalidInput = errors.New("invalid input")
)

// Verificación de errores
user, err := getUser("123")
if err != nil {
    if errors.Is(err, ErrNotFound) {
        // Manejar not found
    } else {
        // Manejar otros errores
    }
}
```

---

### Rust

**Result y Option Types:**

```rust
use std::fs::File;
use std::io::{self, Read};

// Result type para operaciones que pueden fallar
fn read_file(path: &str) -> Result<String, io::Error> {
    let mut file = File::open(path)?;  // ? operator propaga errores
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}

// Tipos de error custom
#[derive(Debug)]
enum AppError {
    Io(io::Error),
    Parse(std::num::ParseIntError),
    NotFound(String),
    Validation(String),
}

impl From<io::Error> for AppError {
    fn from(error: io::Error) -> Self {
        AppError::Io(error)
    }
}
```

---

## Patrones Universales

### Pattern 1: Circuit Breaker

Previene fallos en cascada en sistemas distribuidos.

```python
from enum import Enum
from datetime import datetime, timedelta

class CircuitState(Enum):
    CLOSED = "closed"       # Operación normal
    OPEN = "open"          # Fallando, rechazar requests
    HALF_OPEN = "half_open"  # Probando si recuperó

class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 5,
        timeout: timedelta = timedelta(seconds=60),
        success_threshold: int = 2
    ):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.success_threshold = success_threshold
        self.failure_count = 0
        self.success_count = 0
        self.state = CircuitState.CLOSED
        self.last_failure_time = None

    def call(self, func):
        if self.state == CircuitState.OPEN:
            if datetime.now() - self.last_failure_time > self.timeout:
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
            else:
                raise Exception("Circuit breaker is OPEN")

        try:
            result = func()
            self.on_success()
            return result
        except Exception as e:
            self.on_failure()
            raise

# Uso
circuit_breaker = CircuitBreaker()

def fetch_data():
    return circuit_breaker.call(lambda: external_api.get_data())
```

### Pattern 2: Error Aggregation

Recolecta múltiples errores en lugar de fallar en el primero.

```typescript
class ErrorCollector {
  private errors: Error[] = [];

  add(error: Error): void {
    this.errors.push(error);
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  throw(): never {
    if (this.errors.length === 1) {
      throw this.errors[0];
    }
    throw new AggregateError(this.errors, `${this.errors.length} errors occurred`);
  }
}

// Uso: Validar múltiples campos
function validateUser(data: any): User {
  const errors = new ErrorCollector();

  if (!data.email) {
    errors.add(new ValidationError("Email is required"));
  }
  if (!data.name || data.name.length < 2) {
    errors.add(new ValidationError("Name must be at least 2 characters"));
  }

  if (errors.hasErrors()) {
    errors.throw();
  }
  return data as User;
}
```

### Pattern 3: Graceful Degradation

Proporciona funcionalidad de fallback cuando ocurren errores.

```python
def with_fallback(primary, fallback, log_error: bool = True):
    """Try primary function, fall back to fallback on error."""
    try:
        return primary()
    except Exception as e:
        if log_error:
            logger.error(f"Primary function failed: {e}")
        return fallback()

# Uso
def get_user_profile(user_id: str) -> UserProfile:
    return with_fallback(
        primary=lambda: fetch_from_cache(user_id),
        fallback=lambda: fetch_from_database(user_id)
    )
```

---

## Best Practices

| Práctica | Descripción |
|----------|-------------|
| **Fail Fast** | Valida input temprano, falla rápido |
| **Preservar Contexto** | Incluye stack traces, metadata, timestamps |
| **Mensajes Significativos** | Explica qué pasó y cómo arreglarlo |
| **Loggear Apropiadamente** | Error = log, fallo esperado = no spam |
| **Manejar en Nivel Correcto** | Catch donde puedas manejar significativamente |
| **Limpiar Recursos** | Usa try-finally, context managers, defer |
| **No Tragar Errores** | Log o re-throw, no ignorar silenciosamente |
| **Errores Type-Safe** | Usa errores tipados cuando sea posible |

## Errores Comunes a Evitar

- ❌ **Catch demasiado amplio**: `except Exception` oculta bugs
- ❌ **Bloques catch vacíos**: Tragar errores silenciosamente
- ❌ **Log y re-throw**: Crea entradas de log duplicadas
- ❌ **No limpiar**: Olvidar cerrar archivos, conexiones
- ❌ **Mensajes pobres**: "Error occurred" no es útil
- ❌ **Retornar códigos de error**: Usa excepciones o Result types
- ❌ **Ignorar errores async**: Promesas rechazadas sin manejar

---

> **Nota**: Esta skill proporciona patrones para múltiples lenguajes. Adapta los ejemplos según el stack tecnológico específico del proyecto.
