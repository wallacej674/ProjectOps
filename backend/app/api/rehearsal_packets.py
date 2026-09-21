from fastapi import APIRouter, Query, Request
from app.api.rehearsal import Db, UserDep, bounded_input
from app.models.rehearsal_packets import RehearsalPacket, RehearsalResult
from app.schemas.rehearsal_packets import PacketInput, ResultInput
from app.services import rehearsal, rehearsal_packets as service

router = APIRouter(prefix='/projects/{project_id}/releases/{release_id}/rehearsal', tags=['Release Rehearsal'])


@router.post('/packets', status_code=201)
async def create_packet(project_id: int, release_id: int, request: Request, db: Db, user: UserDep):
    rehearsal.owned(db, project_id, release_id, user.id, True)
    data = await bounded_input(request, PacketInput)
    return service.create_packet(db, project_id, release_id, user.id, data)


@router.get('/packets')
def packets(project_id: int, release_id: int, db: Db, user: UserDep,
            offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    return rehearsal.list_records(db, project_id, release_id, user.id, RehearsalPacket, service.read_packet, offset, limit)


@router.get('/packets/{packet_id}')
def packet(project_id: int, release_id: int, packet_id: int, db: Db, user: UserDep):
    rehearsal.owned(db, project_id, release_id, user.id)
    return service.read_packet(service.packet_for(db, release_id, packet_id))


@router.post('/results/preview')
async def preview_result(project_id: int, release_id: int, request: Request, db: Db, user: UserDep):
    rehearsal.owned(db, project_id, release_id, user.id)
    data = await bounded_input(request, ResultInput)
    return service.preview_result(db, project_id, release_id, user.id, data)


@router.post('/results', status_code=201)
async def import_result(project_id: int, release_id: int, request: Request, db: Db, user: UserDep):
    rehearsal.owned(db, project_id, release_id, user.id, True)
    data = await bounded_input(request, ResultInput)
    return service.import_result(db, project_id, release_id, user.id, data)


@router.get('/results')
def results(project_id: int, release_id: int, db: Db, user: UserDep,
            offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    return rehearsal.list_records(db, project_id, release_id, user.id, RehearsalResult, service.read_result, offset, limit)

