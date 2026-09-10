"""Two ways a whole school batch dies in seconds, with nothing in the UI.

Both faults share a mechanism: the failure is classified *permanent* by
`_is_permanent_llm_error`, so `LLMClient.generate` re-raises on the first attempt
with no retry. `run_report_generation` then reports `completed == 0`, and
`sessions.py` deliberately leaves `session.status` unchanged when nothing was
produced — so the counsellor watches a spinner that never resolves and no error
is surfaced anywhere. At 300 students per school that is the entire pilot.

Fault 1: an output ceiling above the provider's own cap is a hard 400, not a
clamp. A single 32,000 was briefly applied to all four providers; gpt-4o-mini
caps completion at 16,384.

Fault 2: an unknown provider string raises ValueError, which is in
_PERMANENT_LLM_ERROR_NAMES. The session-creation form is the obvious source.
"""

import inspect

import pytest

import config
from engines import report_generator


class TestPerProviderOutputCaps:
    def test_openai_ceiling_is_within_gpt_4o_mini_limit(self):
        """gpt-4o-mini rejects max_tokens above 16,384 with a 400."""
        assert config.max_output_tokens_for("openai") <= 16384

    def test_groq_diagnostic_reads_the_ceiling_instead_of_duplicating_it(self):
        """fix_groq.py's APP_MAX_TOKENS drifting from _call_groq is what hid this.

        Asserted against the source text, not by importing: fix_groq is an
        interactive operator script and prompts on import.
        """
        import pathlib

        src = (
            pathlib.Path(__file__).resolve().parents[2] / "fix_groq.py"
        ).read_text()
        assert "APP_MAX_TOKENS = 12000  # must match _call_groq" not in src, (
            "the diagnostic hardcodes a ceiling again — it will drift"
        )
        assert 'max_output_tokens_for("groq")' in src

    def test_google_keeps_the_headroom_that_fixed_truncation(self):
        """A complete report is ~12k output tokens; 12,000 truncated mid-string."""
        assert config.max_output_tokens_for("google") >= 20000

    def test_no_call_site_uses_a_single_global_ceiling(self):
        """Each provider must ask for its own cap, not one shared constant."""
        src = inspect.getsource(report_generator)
        assert "max_tokens=LLM_MAX_OUTPUT_TOKENS" not in src
        assert "max_output_tokens=LLM_MAX_OUTPUT_TOKENS" not in src
        for provider in ("openai", "google", "groq"):
            assert f'max_output_tokens_for("{provider}")' in src

    def test_anthropic_still_uses_its_fixed_two_pass_budget(self):
        """_call_anthropic splits generation to stay under 8192 on purpose."""
        assert "max_tokens=8192" in inspect.getsource(report_generator)

    def test_an_unknown_provider_falls_back_rather_than_crashing(self):
        assert config.max_output_tokens_for("something-else") > 0


class TestSessionProviderIsValidated:
    def test_unknown_provider_is_rejected_at_the_api_boundary(self):
        """Otherwise it reaches LLMClient.generate and is classified permanent."""
        from pydantic import ValidationError

        from routers.sessions import SessionCreate

        with pytest.raises(ValidationError, match="unknown llm_provider"):
            SessionCreate(school_id=1, session_date="2026-09-04", llm_provider="grok")

    def test_blank_provider_means_the_configured_default(self):
        from routers.sessions import SessionCreate

        s = SessionCreate(school_id=1, session_date="2026-09-04", llm_provider="")
        assert s.llm_provider == config.DEFAULT_LLM_PROVIDER

    @pytest.mark.parametrize("provider", ["google", "openai", "anthropic", "groq"])
    def test_every_configured_provider_is_accepted(self, provider):
        from routers.sessions import SessionCreate

        s = SessionCreate(school_id=1, session_date="2026-09-04", llm_provider=provider)
        assert s.llm_provider == provider

    def test_the_session_form_does_not_pin_a_model_client_side(self):
        """The new-session form hardcoded `llm_provider: "groq"`, and the override
        dropdown rendered only for admins — so every counsellor-created session
        was pinned to llama-3.1-8b-instant regardless of deployment config, which
        the backend itself rates as too small to emit the report schema.
        """
        import pathlib

        page = (
            pathlib.Path(__file__).resolve().parents[2]
            / "frontend/src/app/sessions/new/page.tsx"
        ).read_text()
        assert 'llm_provider: "groq"' not in page, "session form pins groq again"
