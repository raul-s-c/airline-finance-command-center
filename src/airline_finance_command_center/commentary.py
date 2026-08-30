from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class VarianceInput:
    metric: str
    current: float | None
    prior: float | None
    absolute_variance: float | None
    percentage_variance: float | None
    unit: str = "value"


@dataclass(frozen=True)
class DriverContribution:
    driver: str
    contribution: float
    explanation: str


@dataclass(frozen=True)
class CommentaryRule:
    metric: str
    absolute_materiality: float = 0.0
    percentage_materiality: float = 0.0
    favorable_direction: str | None = None


@dataclass(frozen=True)
class CommentaryItem:
    metric: str
    headline: str
    detail: str
    material: bool
    evidence: tuple[str, ...]


def is_material(variance: VarianceInput, rule: CommentaryRule) -> bool:
    if variance.absolute_variance is None or variance.percentage_variance is None:
        return False
    return (
        abs(variance.absolute_variance) >= rule.absolute_materiality
        and abs(variance.percentage_variance) >= rule.percentage_materiality
    )


def direction_word(value: float) -> str:
    if value > 0:
        return "increased"
    if value < 0:
        return "decreased"
    return "was unchanged"


def format_change(value: float, unit: str) -> str:
    magnitude = abs(value)
    if unit == "usd_millions":
        return f"${magnitude:,.1f}m"
    if unit == "percentage_points":
        return f"{magnitude:.1f}pp"
    if unit == "percent":
        return f"{magnitude:.1f}%"
    return f"{magnitude:,.1f}"


def build_commentary(
    variance: VarianceInput,
    rule: CommentaryRule,
    drivers: Iterable[DriverContribution] = (),
    *,
    max_drivers: int = 2,
) -> CommentaryItem | None:
    if not is_material(variance, rule):
        return None

    assert variance.absolute_variance is not None
    assert variance.percentage_variance is not None

    headline = (
        f"{variance.metric} {direction_word(variance.absolute_variance)} by "
        f"{format_change(variance.absolute_variance, variance.unit)} "
        f"({abs(variance.percentage_variance) * 100:.1f}%)."
    )

    ordered_drivers = sorted(
        drivers,
        key=lambda item: abs(item.contribution),
        reverse=True,
    )[:max_drivers]

    evidence = [
        f"absolute_variance={variance.absolute_variance}",
        f"percentage_variance={variance.percentage_variance}",
    ]

    if ordered_drivers:
        driver_text = "; ".join(driver.explanation for driver in ordered_drivers)
        detail = f"Main drivers: {driver_text}."
        evidence.extend(
            f"driver:{driver.driver}={driver.contribution}"
            for driver in ordered_drivers
        )
    else:
        detail = "No validated driver decomposition is available for this movement."

    return CommentaryItem(
        metric=variance.metric,
        headline=headline,
        detail=detail,
        material=True,
        evidence=tuple(evidence),
    )


def build_commentary_pack(
    variances: Iterable[VarianceInput],
    rules: dict[str, CommentaryRule],
    drivers_by_metric: dict[str, tuple[DriverContribution, ...]] | None = None,
) -> tuple[CommentaryItem, ...]:
    drivers_by_metric = drivers_by_metric or {}
    items: list[CommentaryItem] = []

    for variance in variances:
        rule = rules.get(variance.metric)
        if rule is None:
            continue
        item = build_commentary(
            variance,
            rule,
            drivers_by_metric.get(variance.metric, ()),
        )
        if item is not None:
            items.append(item)

    return tuple(items)
