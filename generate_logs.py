#!/usr/bin/env python3
"""Generate synthetic log files compatible with log-chaos-visualizer.

Supports Pino, Winston, Loki, Promtail, Docker JSON logs, and plain text lines.
Useful for generating large test files (e.g. 20k, 50k, 100k lines).

Usage examples:

  python generate_logs.py --lines 20000 --output public/data/generated-20000.log
  python generate_logs.py --lines 50000 --output public/data/generated-50000.log --mix pino,winston,text
"""

from __future__ import annotations

import argparse
import json
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Iterable, List, Tuple

LOG_KINDS: Tuple[str, ...] = ("pino", "winston", "loki", "promtail", "docker", "text")


@dataclass
class GeneratorConfig:
    kinds: Tuple[str, ...]
    total_lines: int
    seed: int | None


def _rand_hostname() -> str:
    return f"host-{random.randint(1, 10)}"


def _rand_service_name() -> str:
    return random.choice(["auth-service", "api-gateway", "billing", "search", "worker"])


def _rand_environment() -> str:
    return random.choice(["dev", "staging", "prod"])


def _rand_pino_level() -> int:
    return random.choice([10, 20, 30, 40, 50, 60])


def _rand_winston_level() -> str:
    return random.choice(["silly", "debug", "verbose", "info", "warn", "error"])


def _rand_promtail_level() -> str:
    return random.choice(["debug", "info", "warn", "error"])


def _rand_http_method() -> str:
    return random.choice(["GET", "POST", "PUT", "PATCH", "DELETE"])


def _rand_path() -> str:
    return random.choice(
        [
            "/api/login",
            "/api/logout",
            "/api/orders",
            "/api/orders/123",
            "/health",
            "/metrics",
            "/api/search?q=test",
        ]
    )


def _rand_message() -> str:
    base = random.choice(
        [
            "User logged in",
            "User logged out",
            "Order created",
            "Order updated",
            "Cache miss",
            "Cache hit",
            "Background job started",
            "Background job finished",
            "Database query executed",
        ]
    )
    extra = f"userId={random.randint(1, 1000)}"
    return f"{base} {extra}"


def _rand_iso_timestamp() -> str:
    now = datetime.now(timezone.utc)
    delta = timedelta(seconds=random.randint(-3600, 0))
    return (now + delta).isoformat()


def _rand_epoch_millis() -> int:
    now = datetime.now(timezone.utc)
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    return int((now - epoch).total_seconds() * 1000)


def generate_pino_line() -> str:
    entry = {
        "time": _rand_epoch_millis(),
        "level": _rand_pino_level(),
        "pid": random.randint(1000, 9999),
        "hostname": _rand_hostname(),
        "name": _rand_service_name(),
        "msg": _rand_message(),
    }

    if random.random() < 0.7:
        entry["req"] = {
            "id": f"req-{random.randint(1_000_000, 9_999_999)}",
            "method": _rand_http_method(),
            "url": _rand_path(),
            "remoteAddress": f"192.168.0.{random.randint(1, 254)}",
        }

    if random.random() < 0.7:
        entry["res"] = {
            "statusCode": random.choice([200, 201, 204, 400, 401, 403, 404, 500]),
            "responseTimeMs": random.randint(1, 500),
        }

    if random.random() < 0.4:
        entry["meta"] = {
            "traceId": f"trace-{random.randint(1_000_000, 9_999_999)}",
            "spanId": f"span-{random.randint(1_000_000, 9_999_999)}",
        }

    return json.dumps(entry, separators=(",", ":"))


def generate_winston_line() -> str:
    entry = {
        "timestamp": _rand_iso_timestamp(),
        "level": _rand_winston_level(),
        "message": _rand_message(),
    }
    if random.random() < 0.5:
        entry["meta"] = {
            "requestId": f"req-{random.randint(1_000_000, 9_999_999)}",
            "userId": random.randint(1, 1000),
        }
    return json.dumps(entry, separators=(",", ":"))


def generate_loki_line() -> str:
    entry = {
        "ts": _rand_iso_timestamp(),
        "labels": {
            "job": "app-logs",
            "instance": _rand_hostname(),
            "app": _rand_service_name(),
            "environment": _rand_environment(),
        },
        "line": _rand_message(),
    }
    return json.dumps(entry, separators=(",", ":"))


def generate_promtail_line() -> str:
    entry = {
        "ts": _rand_iso_timestamp(),
        "level": _rand_promtail_level(),
        "message": _rand_message(),
    }
    return json.dumps(entry, separators=(",", ":"))


def generate_docker_line() -> str:
    entry = {
        "log": _rand_message() + "\n",
        "stream": random.choice(["stdout", "stderr"]),
        "time": _rand_iso_timestamp(),
    }
    return json.dumps(entry, separators=(",", ":"))


def generate_text_line() -> str:
    level = random.choice(["INFO", "WARN", "ERROR", "DEBUG", "TRACE"])
    parts = [
        level,
        datetime.now(timezone.utc).isoformat(),
        _rand_service_name() + ":",
        _rand_message(),
    ]
    return " ".join(parts)


GENERATOR_BY_KIND: dict[str, Callable[[], str]] = {
    "pino": generate_pino_line,
    "winston": generate_winston_line,
    "loki": generate_loki_line,
    "promtail": generate_promtail_line,
    "docker": generate_docker_line,
    "text": generate_text_line,
}


def plan_distribution(total_lines: int, kinds: Tuple[str, ...]) -> List[str]:
    """Return a list of kinds of length total_lines in roughly even distribution."""
    n_kinds = len(kinds)
    base = total_lines // n_kinds
    remainder = total_lines % n_kinds

    distribution: List[str] = []
    for idx, kind in enumerate(kinds):
        count = base + (1 if idx < remainder else 0)
        distribution.extend([kind] * count)

    random.shuffle(distribution)
    return distribution


def generate_logs(config: GeneratorConfig, output_path: Path) -> None:
    for kind in config.kinds:
        if kind not in GENERATOR_BY_KIND:
            raise ValueError(f"Unsupported log kind in mix: {kind!r}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    if config.seed is not None:
        random.seed(config.seed)

    distribution = plan_distribution(config.total_lines, config.kinds)

    with output_path.open("w", encoding="utf-8") as f:
        for idx, kind in enumerate(distribution, start=1):
            line = GENERATOR_BY_KIND[kind]()
            if line.endswith("\n"):
                line = line.rstrip("\n")
            f.write(line + "\n")

            if idx % 10000 == 0:
                print(f"... generated {idx} lines", file=sys.stderr)


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate synthetic log files for log-chaos-visualizer.")
    parser.add_argument("--lines", type=int, required=True, help="Number of log lines to generate.")
    parser.add_argument(
        "--output",
        type=str,
        required=True,
        help="Path to output .log file (e.g. public/data/generated-20000.log).",
    )
    parser.add_argument(
        "--mix",
        type=str,
        default=",".join(LOG_KINDS),
        help=(
            "Comma-separated list of log kinds to include. "
            "Supported kinds: pino,winston,loki,promtail,docker,text. Default: all kinds."
        ),
    )
    parser.add_argument("--seed", type=int, default=None, help="Optional random seed for reproducible output.")
    return parser.parse_args(argv)


def main(argv: Iterable[str] | None = None) -> int:
    import sys

    args = parse_args(argv)

    if args.lines <= 0:
        print("--lines must be a positive integer", file=sys.stderr)
        return 1

    kinds = tuple(k.strip() for k in args.mix.split(",") if k.strip())
    if not kinds:
        print("No log kinds specified in --mix", file=sys.stderr)
        return 1

    config = GeneratorConfig(kinds=kinds, total_lines=args.lines, seed=args.seed)
    output_path = Path(args.output)

    print(
        f"Generating {config.total_lines} lines into {output_path} "
        f"with mix={','.join(config.kinds)} seed={config.seed}",
        file=sys.stderr,
    )

    generate_logs(config, output_path)

    print("Done.", file=sys.stderr)
    return 0


if __name__ == "__main__":  # pragma: no cover
    import sys

    raise SystemExit(main(sys.argv[1:]))

