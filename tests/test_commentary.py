from airline_finance_command_center.commentary import (
    CommentaryRule,
    DriverContribution,
    VarianceInput,
    build_commentary,
    build_commentary_pack,
    is_material,
)


def test_materiality_requires_both_thresholds() -> None:
    rule = CommentaryRule("Revenue", absolute_materiality=50, percentage_materiality=0.05)
    assert is_material(VarianceInput("Revenue", 1100, 1000, 100, 0.10), rule)
    assert not is_material(VarianceInput("Revenue", 1010, 1000, 10, 0.10), rule)
    assert not is_material(VarianceInput("Revenue", 1060, 1000, 60, 0.02), rule)


def test_build_commentary_uses_largest_validated_drivers() -> None:
    variance = VarianceInput("Revenue", 1100, 1000, 100, 0.10, "usd_millions")
    rule = CommentaryRule("Revenue", absolute_materiality=25, percentage_materiality=0.03)
    drivers = (
        DriverContribution("volume", 70, "higher passenger volume contributed $70m"),
        DriverContribution("price", 20, "higher revenue per passenger contributed $20m"),
        DriverContribution("mix", 10, "route mix contributed $10m"),
    )

    item = build_commentary(variance, rule, drivers)

    assert item is not None
    assert "increased by $100.0m" in item.headline
    assert "higher passenger volume" in item.detail
    assert "higher revenue per passenger" in item.detail
    assert "route mix" not in item.detail
    assert "driver:volume=70" in item.evidence


def test_build_commentary_refuses_unmaterial_movement() -> None:
    variance = VarianceInput("Revenue", 1010, 1000, 10, 0.01, "usd_millions")
    rule = CommentaryRule("Revenue", absolute_materiality=25, percentage_materiality=0.03)
    assert build_commentary(variance, rule) is None


def test_build_commentary_does_not_invent_driver() -> None:
    variance = VarianceInput("Fuel Cost", 460, 400, 60, 0.15, "usd_millions")
    rule = CommentaryRule("Fuel Cost", absolute_materiality=20, percentage_materiality=0.05)

    item = build_commentary(variance, rule)

    assert item is not None
    assert "No validated driver decomposition" in item.detail


def test_commentary_pack_only_emits_metrics_with_rules_and_materiality() -> None:
    variances = (
        VarianceInput("Revenue", 1100, 1000, 100, 0.10, "usd_millions"),
        VarianceInput("Fuel Cost", 405, 400, 5, 0.0125, "usd_millions"),
        VarianceInput("Passengers", 120, 100, 20, 0.20),
    )
    rules = {
        "Revenue": CommentaryRule("Revenue", 25, 0.03),
        "Fuel Cost": CommentaryRule("Fuel Cost", 20, 0.05),
    }

    pack = build_commentary_pack(variances, rules)

    assert len(pack) == 1
    assert pack[0].metric == "Revenue"
