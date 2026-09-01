"""The LLM provider must come from configuration, never a hardcoded vendor.

Both defaults were literal "anthropic" while the deployment was configured end
to end for Groq's free tier. Nothing failed loudly: sessions created through the
UI (which sends no llm_provider) and every /students/{id}/regenerate call billed
Anthropic at roughly $0.01-0.03 a report. A test that only asserted "a provider
is set" would have passed throughout, so these assert the value tracks config.
"""

import inspect

import config
from engines.report_generator import generate_single_report
from routers.sessions import SessionCreate


def test_session_create_defaults_to_the_configured_provider():
    assert SessionCreate.model_fields["llm_provider"].default == config.DEFAULT_LLM_PROVIDER


def test_session_create_default_is_not_a_hardcoded_vendor():
    # Guards the specific regression: re-pinning the default to a vendor literal
    # would still satisfy the test above whenever DEFAULT_LLM_PROVIDER happens to
    # equal it, so assert the field is not a literal at all.
    src = inspect.getsource(SessionCreate)
    assert 'llm_provider: str = "anthropic"' not in src
    assert "llm_provider: str = DEFAULT_LLM_PROVIDER" in src


def test_generate_single_report_falls_back_to_configured_provider():
    default = inspect.signature(generate_single_report).parameters["provider"].default
    assert default != "anthropic", "provider default is hardcoded to a vendor again"
    # An empty default means the body resolves it; confirm the body actually does.
    assert default == ""
    assert "provider = provider or DEFAULT_LLM_PROVIDER" in inspect.getsource(
        generate_single_report
    )


def test_regenerate_passes_no_provider_so_the_fallback_governs():
    # /students/{id}/regenerate calls generate_single_report(student, kb) with no
    # provider, which is why the fallback above is what makes the route usable on
    # a non-Anthropic deployment.
    from routers.students import regenerate_report

    src = inspect.getsource(regenerate_report)
    assert "generate_single_report(student, kb)" in src
    assert "anthropic" not in src.lower()


def test_batch_generation_default_is_not_a_hardcoded_vendor():
    """The batch entry point had the same "anthropic" literal as the other two.

    Its only caller passes session.llm_provider explicitly, so this never fired
    in production — which is exactly why it survived. Guard it anyway.
    """
    default = inspect.signature(
        __import__("tasks.batch_processor", fromlist=["run_report_generation"])
        .run_report_generation
    ).parameters["provider"].default
    assert default != "anthropic"
    assert default == ""


def test_google_model_default_is_not_a_retired_model():
    """gemini-2.0-flash and gemini-2.5-flash both 404 with "no longer available".

    A retired default breaks any fresh deploy that does not set GOOGLE_MODEL,
    and the failure surfaces as a generation error long after startup.
    """
    assert config.LLM_MODELS["google"] not in ("gemini-2.0-flash", "gemini-2.5-flash")
