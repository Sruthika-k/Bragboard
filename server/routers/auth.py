from fastapi import APIRouter

from .. import database, models, auth as core_auth

# Re-export the existing auth router without changing any logic
router: APIRouter = core_auth.router
