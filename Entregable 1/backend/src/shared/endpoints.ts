export const endpoints = [
  {
    "metodo": "POST",
    "ruta": "/auth/login",
    "module": "seguridad",
    "owner": "Nayemy",
    "handler": "login",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/auth/me",
    "module": "seguridad",
    "owner": "Nayemy",
    "handler": "getMe",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/roles",
    "module": "seguridad",
    "owner": "Nayemy",
    "handler": "listRoles",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/permisos",
    "module": "seguridad",
    "owner": "Nayemy",
    "handler": "listPermissions",
    "status": "pending"
  },
  {
    "metodo": "POST",
    "ruta": "/usuarios",
    "module": "seguridad",
    "owner": "Nayemy",
    "handler": "createUser",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/usuarios",
    "module": "seguridad",
    "owner": "Nayemy",
    "handler": "listUsers",
    "status": "pending"
  },
  {
    "metodo": "PATCH",
    "ruta": "/usuarios/:id",
    "module": "seguridad",
    "owner": "Nayemy",
    "handler": "updateUser",
    "status": "pending"
  },
  {
    "metodo": "PUT",
    "ruta": "/roles/:id/permisos",
    "module": "seguridad",
    "owner": "Nayemy",
    "handler": "replaceRolePermissions",
    "status": "pending"
  },
  {
    "metodo": "POST",
    "ruta": "/pacientes",
    "module": "pacientes",
    "owner": "Erick",
    "handler": "createPatient",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/pacientes",
    "module": "pacientes",
    "owner": "Erick",
    "handler": "listPatients",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/pacientes/:id",
    "module": "pacientes",
    "owner": "Erick",
    "handler": "getPatient",
    "status": "pending"
  },
  {
    "metodo": "PATCH",
    "ruta": "/pacientes/:id",
    "module": "pacientes",
    "owner": "Erick",
    "handler": "updatePatient",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/pacientes/:id/historia",
    "module": "pacientes",
    "owner": "Erick",
    "handler": "getHistory",
    "status": "pending"
  },
  {
    "metodo": "POST",
    "ruta": "/pacientes/:id/antecedentes",
    "module": "pacientes",
    "owner": "Erick",
    "handler": "createAntecedent",
    "status": "pending"
  },
  {
    "metodo": "PATCH",
    "ruta": "/historias/:id/cuestionario",
    "module": "pacientes",
    "owner": "Erick",
    "handler": "updateQuestionnaire",
    "status": "pending"
  },
  {
    "metodo": "DELETE",
    "ruta": "/pacientes/:id/contactos/:contactoId",
    "module": "pacientes",
    "owner": "Erick",
    "handler": "deleteContact",
    "status": "pending"
  },
  {
    "metodo": "POST",
    "ruta": "/empleados",
    "module": "personal",
    "owner": "Josenrique",
    "handler": "createEmployee",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/empleados",
    "module": "personal",
    "owner": "Josenrique",
    "handler": "listEmployees",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/empleados/:id",
    "module": "personal",
    "owner": "Josenrique",
    "handler": "getEmployee",
    "status": "pending"
  },
  {
    "metodo": "PATCH",
    "ruta": "/empleados/:id",
    "module": "personal",
    "owner": "Josenrique",
    "handler": "updateEmployee",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/odontologos",
    "module": "personal",
    "owner": "Josenrique",
    "handler": "listDentists",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/tratamientos",
    "module": "personal",
    "owner": "Josenrique",
    "handler": "listTreatments",
    "status": "pending"
  },
  {
    "metodo": "POST",
    "ruta": "/tratamientos",
    "module": "personal",
    "owner": "Josenrique",
    "handler": "createTreatment",
    "status": "pending"
  },
  {
    "metodo": "PATCH",
    "ruta": "/tratamientos/:id",
    "module": "personal",
    "owner": "Josenrique",
    "handler": "updateTreatment",
    "status": "pending"
  },
  {
    "metodo": "POST",
    "ruta": "/planes-tratamiento",
    "module": "planes",
    "owner": "Esaul",
    "handler": "createPlan",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/planes-tratamiento",
    "module": "planes",
    "owner": "Esaul",
    "handler": "listPlans",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/planes-tratamiento/:id",
    "module": "planes",
    "owner": "Esaul",
    "handler": "getPlan",
    "status": "pending"
  },
  {
    "metodo": "PATCH",
    "ruta": "/planes-tratamiento/:id",
    "module": "planes",
    "owner": "Esaul",
    "handler": "updatePlan",
    "status": "pending"
  },
  {
    "metodo": "POST",
    "ruta": "/planes-tratamiento/:id/presupuestos",
    "module": "planes",
    "owner": "Esaul",
    "handler": "createBudget",
    "status": "pending"
  },
  {
    "metodo": "POST",
    "ruta": "/presupuestos/:id/aceptacion",
    "module": "planes",
    "owner": "Esaul",
    "handler": "acceptBudget",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/obligaciones/:id",
    "module": "planes",
    "owner": "Esaul",
    "handler": "getObligation",
    "status": "pending"
  },
  {
    "metodo": "PATCH",
    "ruta": "/presupuestos/:id/revisor",
    "module": "planes",
    "owner": "Esaul",
    "handler": "updateReviewer",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/metodos-pago",
    "module": "pagos",
    "owner": "Rodrigo",
    "handler": "listPaymentMethods",
    "status": "pending"
  },
  {
    "metodo": "POST",
    "ruta": "/metodos-pago",
    "module": "pagos",
    "owner": "Rodrigo",
    "handler": "createPaymentMethod",
    "status": "pending"
  },
  {
    "metodo": "POST",
    "ruta": "/pagos",
    "module": "pagos",
    "owner": "Rodrigo",
    "handler": "createPayment",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/pagos/:id",
    "module": "pagos",
    "owner": "Rodrigo",
    "handler": "getPayment",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/pacientes/:id/estado-cuenta",
    "module": "pagos",
    "owner": "Rodrigo",
    "handler": "getAccount",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/pagos/:id/comprobante",
    "module": "pagos",
    "owner": "Rodrigo",
    "handler": "getReceipt",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/reportes/cuentas-por-cobrar",
    "module": "pagos",
    "owner": "Rodrigo",
    "handler": "getReceivablesReport",
    "status": "pending"
  },
  {
    "metodo": "GET",
    "ruta": "/mi/estado-cuenta",
    "module": "pagos",
    "owner": "Rodrigo",
    "handler": "getMyAccount",
    "status": "pending"
  }
] as const

