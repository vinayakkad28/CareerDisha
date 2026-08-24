import logging
from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from config import DATABASE_URL

logger = logging.getLogger(__name__)

if "sqlite" in DATABASE_URL:
    logger.warning("SQLite detected. Not recommended for production — concurrent writes will fail. Set DATABASE_URL to PostgreSQL.")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Deterministic constraint names. Without these, indexes and foreign keys get
# backend-generated names, so Alembic cannot reliably ALTER or DROP them later —
# and this schema has a genuine FK cycle (students.d2c_assessment_id <->
# d2c_assessments.student_id) whose constraints must be added by name after both
# tables exist. Setting this before the first migration is free; changing it
# after a database exists means renaming every constraint by hand.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
