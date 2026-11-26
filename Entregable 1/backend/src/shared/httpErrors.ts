import type { ErrorRequestHandler } from 'express'
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
 console.error('Error de infraestructura:', error?.message ?? 'Error desconocido')
 const status=error?.type==='entity.parse.failed'?400:error?.type==='entity.too.large'?413:500
 res.status(status).json({ error: { codigo: status===400?'JSON_INVALIDO':status===413?'CUERPO_DEMASIADO_GRANDE':'ERROR_INTERNO', mensaje: status===400?'El cuerpo debe contener JSON válido.':status===413?'El cuerpo supera el tamaño permitido.':'No se pudo completar la solicitud.', detalles: [] } })
}

