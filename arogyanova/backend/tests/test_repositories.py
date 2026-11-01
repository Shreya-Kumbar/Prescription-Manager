"""
Tests for ArogyaNova Repository Pattern & Layered OOP Architecture
"""
import uuid
import pytest
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.db.database import Base
from app.models.models import MedicationModel, PrescriptionModel, UserModel
from app.repositories.medication_repository import SQLAlchemyMedicationRepository
from app.repositories.prescription_repository import SQLAlchemyPrescriptionRepository
from app.repositories.user_repository import SQLAlchemyUserRepository


@pytest.fixture
async def test_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    
    await engine.dispose()


@pytest.mark.asyncio
async def test_medication_repository_crud(test_db: AsyncSession):
    repo = SQLAlchemyMedicationRepository(test_db)
    
    med = MedicationModel(
        id=uuid.uuid4(),
        generic_name="Azithromycin",
        brand_name="Zithromax",
        strength="500mg",
        dosage_form="Tablet",
        category="Antibiotic",
        is_active=True,
    )
    created = await repo.create(med)
    await test_db.commit()
    assert created.generic_name == "Azithromycin"

    fetched = await repo.get_by_id(med.id)
    assert fetched is not None
    assert fetched.brand_name == "Zithromax"

    search_res = await repo.search("Azithro")
    assert len(search_res) == 1
    assert search_res[0].id == med.id

    # Test soft-delete
    deleted = await repo.delete(med.id)
    await test_db.commit()
    assert deleted is True
    assert fetched.is_active is False


@pytest.mark.asyncio
async def test_user_repository_get_by_email(test_db: AsyncSession):
    repo = SQLAlchemyUserRepository(test_db)
    
    user = UserModel(
        id=uuid.uuid4(),
        email="test.doctor@arogyanova.dev",
        hashed_password="some_hashed_password",
        first_name="Test",
        last_name="Doctor",
        role="doctor",
        is_active=True,
    )
    await repo.create(user)
    await test_db.commit()

    found = await repo.get_by_email("test.doctor@arogyanova.dev")
    assert found is not None
    assert found.first_name == "Test"

    # Case-insensitivity test
    found_upper = await repo.get_by_email("TEST.DOCTOR@AROGYANOVA.DEV")
    assert found_upper is not None
