import uuid

from fastapi import APIRouter, File, Form, Query, Response, UploadFile, status

from app.core.storage import storage
from app.dependencies import CurrentUser, DBSession
from app.schemas import DocumentResponse, Page
from app.services.documents import DocumentService
from app.workers.document_tasks import process_document_task

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    session: DBSession,
    user: CurrentUser,
    course_id: uuid.UUID = Form(),
    file: UploadFile = File(),
) -> DocumentResponse:
    document = await DocumentService(session, user.id, storage).upload(course_id, file)
    process_document_task.delay(str(document.id))
    return DocumentResponse.model_validate(document)


@router.get("", response_model=Page[DocumentResponse])
async def list_documents(
    session: DBSession,
    user: CurrentUser,
    course_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Page[DocumentResponse]:
    items, total = await DocumentService(session, user.id, storage).list(page, page_size, course_id)
    return Page(
        items=[DocumentResponse.model_validate(row) for row in items],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> DocumentResponse:
    return DocumentResponse.model_validate(
        await DocumentService(session, user.id, storage).get(document_id)
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> Response:
    await DocumentService(session, user.id, storage).delete(document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
