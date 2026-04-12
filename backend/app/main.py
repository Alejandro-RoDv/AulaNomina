from fastapi import FastAPI

app = FastAPI(
    title="AulaNomina API",
    description="API para la plataforma educativa de simulación laboral y RRHH",
    version="0.1.0"
)

@app.get("/")
def root():
    return {"message": "AulaNomina API funcionando correctamente"}