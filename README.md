# FX-AlphaLab

**Collaborative AI and data-engineering platform for foreign-exchange market analysis.**

> Portfolio note: this repository is a public backup/snapshot of a collaborative academic project. The history includes work from multiple contributors and is preserved to demonstrate the engineering workflow, architecture, and implementation.

## Overview

FX-AlphaLab explores how market data, macroeconomic information, event calendars, news, and machine-learning components can be combined into a modular FX-analysis platform.

The project was designed around a layered data pipeline and a multi-agent architecture rather than a single monolithic model. The goal was to make ingestion, feature engineering, modelling, validation, and downstream consumption independently testable and easier to evolve.

### Currency scope

- EUR/USD
- GBP/USD
- USD/CHF
- USD/JPY

## What the project demonstrates

- Multi-source financial data ingestion
- Event-driven and macroeconomic feature engineering
- Time-series modelling and signal generation
- Modular agent-oriented architecture
- FastAPI services and downstream interfaces
- Automated testing and code-quality checks
- CI/CD and team-based Git workflow
- Reproducible notebook experimentation

## Architecture

```text
External data sources
        |
        v
+--------------------+
| Ingestion layer    |
| prices / macro /   |
| news / calendar    |
+--------------------+
        |
        v
+--------------------+
| Bronze layer       |
| raw source data    |
+--------------------+
        |
        v
+--------------------+
| Silver layer       |
| normalized and     |
| validated data     |
+--------------------+
        |
        v
+--------------------+
| Features & models  |
| event / macro /    |
| technical signals  |
+--------------------+
        |
        v
+--------------------+
| Published context  |
| APIs / snapshots / |
| agent consumption  |
+--------------------+
```

## Main data sources

The project integrates or experiments with several sources depending on the module:

- MetaTrader 5 for OHLC market data
- FRED for macroeconomic indicators
- European Central Bank data and publications
- Economic-calendar events
- Financial news and document sources
- Additional market-context sources used by individual research modules

Collectors are designed to normalize source-specific data into common downstream interfaces.

## Event-driven macro module

One of the project workstreams focuses on economic-calendar information and market reactions.

The pipeline covers:

1. event collection and normalization;
2. actual-versus-forecast surprise calculation;
3. impact and importance weighting;
4. short-horizon price-reaction analysis;
5. currency-level event aggregation;
6. upcoming-event pressure features;
7. publication of stable context snapshots for downstream consumers;
8. validation of directional signals.

This module was intentionally built as an interface that other agents and models can consume rather than as an isolated notebook.

## Modelling approach

The research layer combines several types of information instead of relying on a single predictor:

- recent price behaviour;
- scheduled macroeconomic events;
- event surprise and importance;
- currency relevance;
- temporal context;
- model confidence and ranking metrics.

Experiments include daily and intraday settings, filtered event subsets, and hybrid scores. Model evaluation focuses on metrics such as ROC-AUC, PR-AUC, directional accuracy, and precision among the highest-conviction predictions.

The repository is a research project, so model performance should be interpreted as experimental rather than as a live trading claim.

## Repository structure

```text
.
├── .github/              # CI workflows
├── config/               # configuration
├── data/                 # raw, processed and published datasets
├── docs/                 # technical documentation
├── notebooks/            # modelling and exploratory analysis
├── scripts/              # collection and processing entry points
├── src/
│   ├── agents/           # analysis agents
│   ├── alpha/            # signal/model logic
│   ├── backend/          # API/backend components
│   ├── ingestion/        # collectors and preprocessing
│   └── shared/           # shared utilities and configuration
└── tests/                # automated tests
```

## Engineering workflow

Development followed a team-oriented Git workflow:

```text
main
  └── dev
       ├── feature/...
       ├── fix/...
       └── refactor/...
```

Typical development flow:

1. update `dev`;
2. create a focused feature branch;
3. implement and test the change;
4. run local quality checks;
5. push the branch;
6. open a pull request;
7. merge after review and CI validation.

The repository uses conventional-style commit messages such as `feat:`, `fix:`, `refactor:`, `docs:`, and `test:`.

## Code quality

The development environment includes:

- pytest
- Black
- Ruff
- Mypy
- pre-commit hooks
- GitHub Actions / CI checks

Example local checks:

```bash
black .
ruff check .
mypy src/
pytest
pre-commit run --all-files
```

## Getting started

### Requirements

- Python 3.10+
- Git
- project-specific credentials for external data sources
- MetaTrader 5 only for modules that depend on MT5

### Clone

```bash
git clone https://github.com/aziz696902/FX-AlphaLab-backup-.git
cd FX-AlphaLab-backup-
```

### Environment

```bash
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\activate
```

Linux/macOS:

```bash
source .venv/bin/activate
```

Install development dependencies according to the project configuration, then create your local environment file from `.env.example` where applicable.

## Example development workflow

```bash
git switch dev
git pull origin dev

git switch -c feature/example-improvement

# make changes

pre-commit run --all-files
pytest

git add .
git commit -m "feat: add example improvement"
git push -u origin feature/example-improvement
```

## Notes

- Some data collectors require API keys or external services.
- Market-data availability can depend on the operating system and broker setup.
- Large generated datasets and local credentials should not be committed.
- This repository contains research and engineering work; it is not financial advice or a production trading service.

## Project context

FX-AlphaLab was developed as a collaborative engineering project involving data science, software engineering, financial-data ingestion, model experimentation, and integration work.

The repository is kept public as a technical portfolio artifact showing the architecture and development practices used during the project.
