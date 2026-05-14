# Refactor Plan: Lower-Cost, Higher-Quality BI Dashboard Generator Backend

## 1. Context

This project is a Plotly-based dashboard generator that should behave like a Power BI-style BI analyst.

Current user flow:

```text
User uploads CSV
→ backend profiles dataset
→ LLM receives dataset_profile + long BI rules
→ LLM outputs dashboard JSON
→ frontend/backend renders Plotly charts
→ deterministic layout packer places charts
```

The product goal is to generate useful executive dashboards automatically from uploaded CSV files. The generated dashboard should not feel like random charts. It should feel like a BI analyst looked at the data, understood what the rows and columns mean, inferred possible relationships, then produced a dashboard that helps stakeholders act.

The current LLM prompt already tells the model to:

- act as a senior BI analyst
- design a Power BI-style dashboard
- output strict JSON only
- use only columns from `dataset_profile`
- classify columns into BI roles
- avoid trivial charts
- generate 3-5 KPIs
- generate 8-10 charts when possible
- avoid layout coordinates because the app does deterministic packing

However, the LLM is still doing too much work per request. This increases cost and causes inconsistent chart quality.

The current problem:

```text
The LLM is responsible for:
1. understanding the dataset
2. inferring the row grain
3. classifying columns semantically
4. discovering possible relationships
5. validating chart eligibility
6. avoiding weak charts
7. designing pages
8. producing dashboard JSON
9. writing insights
```

This is expensive and unreliable. The backend should take over deterministic tasks so the LLM only performs BI judgment and storytelling.

---

## 2. Core Product Requirement

The product must not be a simple chart picker.

Bad approach:

```text
categorical column + numeric column = bar chart
numeric column = histogram
datetime column + numeric column = line chart
```

This creates random dashboards.

Correct approach:

```text
CSV profile
→ understand what one row represents
→ classify columns semantically
→ infer business entities, metrics, rates, dimensions, and time fields
→ generate possible analytical relationships
→ score and filter valid chart candidates
→ ask LLM to select the strongest candidates
→ output dashboard JSON
```

The LLM should not invent all chart possibilities from scratch. The backend should generate candidate relationships first.

Target behavior:

```text
Backend = profiling, role detection, chart validity, candidate generation, aggregation safety, validation, layout
LLM = selecting useful relationships, grouping pages, writing business questions, titles, explanations, and insights
```

This reduces tokens, improves consistency, and makes the product more sellable.

---

## 3. Target Architecture

Refactor toward this pipeline:

```text
CSV upload
→ dataset profiler
→ semantic role correction
→ row grain inference
→ relationship/candidate chart generator
→ candidate scoring and filtering
→ compact LLM planner payload
→ LLM dashboard JSON
→ JSON validation and repair
→ Plotly renderer
→ deterministic layout packer
```

The existing frontend behavior should be preserved where possible. If the frontend currently expects an older dashboard JSON schema, add a compatibility adapter instead of breaking existing rendering immediately.

---

## 4. Current Prompt Problem

The current planner sends two messages:

1. System prompt
2. User JSON payload

The system prompt is long and contains:

- BI analyst role
- strict JSON requirement
- semantic reasoning rules
- chart eligibility rules
- KPI rules
- dashboard composition rules
- layout omission rules

The user payload contains:

- `user_prompt`
- compacted `dataset_profile`
- `current_dashboard_plan` if refining
- instruction string for generation/refinement
- `allowed_chart_types`
- expected JSON schema

This is logically correct but expensive. It repeats stable rules every time and asks the LLM to validate things that deterministic backend logic can validate more cheaply.

The refactor should reduce LLM responsibility.

---

## 5. New Responsibility Split

### Backend should handle

- CSV parsing
- type inference
- semantic role detection
- metric/rate/dimension/time/identifier classification
- constant and near-constant detection
- ID-like column detection
- row grain inference
- correlation calculation
- time-series metadata calculation
- candidate relationship generation
- candidate scoring
- candidate filtering
- KPI candidate generation
- post-LLM validation
- post-LLM repair
- Plotly chart rendering
- deterministic layout packing

### LLM should handle

- selecting strongest candidate relationships
- rejecting low-value candidates if needed
- grouping related charts into pages
- writing stakeholder-facing page titles
- writing chart titles
- writing business questions
- writing explanations
- writing insights
- refining current dashboard plans based on user prompts

---

## 6. Dataset Profiling Requirements

Create or improve a dataset profiling module.

Suggested functions:

```python
def profile_dataset(df) -> dict:
    ...

def infer_column_roles(df, raw_profile) -> dict:
    ...

def infer_row_grain(profile) -> str:
    ...

def compute_data_quality(df, profile) -> dict:
    ...
```

The final `dataset_profile` should include:

```json
{
  "row_count": 0,
  "column_count": 0,
  "columns": [],
  "numeric_columns": [],
  "categorical_columns": [],
  "datetime_columns": [],
  "metric_candidates": [],
  "rate_metric_candidates": [],
  "dimension_candidates": [],
  "time_candidates": [],
  "identifier_candidates": [],
  "excluded_columns": [],
  "data_quality": {},
  "top_correlations": [],
  "time_series": [],
  "possible_row_grain": "string",
  "possible_relationships": []
}
```

Each column profile should look like:

```json
{
  "name": "string",
  "inferred_type": "numeric | categorical | datetime | boolean | text",
  "role": "metric | rate_metric | dimension | time | identifier | boolean | text | excluded",
  "semantic_type": "string",
  "default_aggregation": "sum | mean | median | count | unique_count | none",
  "unique_count": 0,
  "missing_percent": 0,
  "sample_values": []
}
```

Numeric columns should also include:

```json
{
  "numeric_summary": {
    "min": 0,
    "max": 0,
    "mean": 0,
    "median": 0,
    "cv": 0,
    "skew": 0
  }
}
```

Categorical columns should also include:

```json
{
  "categorical_summary": {
    "top_share": 0,
    "effective_unique": 0,
    "top_values": [
      {"value": "string", "count": 0}
    ]
  }
}
```

Datetime columns should include:

```json
{
  "time_summary": {
    "min": "YYYY-MM-DD",
    "max": "YYYY-MM-DD",
    "span_days": 0,
    "unique_count": 0,
    "detected_granularity": "day | week | month | quarter | year | unknown"
  }
}
```

---

## 7. Semantic Role Detection Rules

The semantic role detection is critical. The dashboard quality depends heavily on correct role classification.

### 7.1 Numeric column should not become ID just because it has high uniqueness

Current risk:

```text
students has 320 unique numeric values
→ wrongly classified as identifier
```

This is bad because `students` is likely a business metric.

Correct behavior:

```text
students = metric
student_id = identifier
student_number = likely identifier
number_of_students = metric
```

A numeric column is likely an identifier only if one or more conditions are true:

- column name contains ID-like terms:
  - `id`
  - `uuid`
  - `code`
  - `key`
  - `ref`
  - `reference`
  - `serial`
  - `identifier`
  - `transaction_id`
  - `customer_id`
  - `order_id`
  - `product_id`
  - `student_id`
  - `employee_id`
- samples look like random codes or references
- values are sequential identifiers
- values are high-cardinality and do not behave like meaningful quantities

High uniqueness alone is insufficient.

### 7.2 Metric-like names

A numeric column should be treated as `metric` when its name suggests a business quantity.

Metric-like terms:

```text
sales
revenue
profit
cost
price
amount
quantity
qty
count
total
students
users
customers
applications
teachers
employees
orders
units
volume
spend
income
expense
salary
score
rating
marks
visits
clicks
impressions
```

Default aggregation for additive metrics:

```text
sum
```

Some score/rating metrics may be better as `mean`, depending on name:

```text
score, rating, satisfaction, nps, index
```

These may be treated as `rate_metric` or non-additive numeric metrics.

### 7.3 Rate metric names

Columns should become `rate_metric` if names contain:

```text
rate
percent
percentage
ratio
margin
conversion
completion_rate
churn_rate
ctr
cvr
accuracy
precision
recall
f1
score
rating
index
average
avg
```

Default aggregation:

```text
mean
```

Never default a rate or percentage to `sum`.

Examples:

```text
completion_rate = rate_metric, mean
conversion_rate = rate_metric, mean
profit_margin = rate_metric, mean
accuracy = rate_metric, mean
```

### 7.4 Time fields

Columns should become `time` if names or values suggest:

```text
date
datetime
timestamp
time
month
year
quarter
week
day
period
fiscal_year
financial_year
```

Important:

- `year` should be time, not categorical, even if read as integer.
- `month` should be time or ordered period, not ordinary categorical.
- Time should usually become chronological axis.
- Avoid bar charts of time counts unless count over time is the actual business question.

### 7.5 Dimensions

A column should become `dimension` if:

- it is categorical
- it has meaningful grouping values
- cardinality is not too high
- values are not free-form text
- values are not identifiers
- values are not constants or near-constants

Examples:

```text
region
country
city
product_category
department
institution
qualification
segment
channel
status
plan_type
```

### 7.6 Text fields

A column should become `text` if:

- values are long free-form text
- average string length is high
- cardinality is high
- values look like comments, descriptions, messages, addresses, or notes

Text fields should generally not be used for chart grouping.

### 7.7 Boolean fields

Boolean fields should be classified as `boolean`.

They may be used for:

- filter flags
- count comparison
- segmentation

They should not be treated as numeric measures by default.

---

## 8. Data Quality and Exclusion Rules

The backend should mark bad analytical columns before LLM call.

`data_quality` should include:

```json
{
  "constant_columns": [],
  "near_constant_columns": [],
  "id_like_columns": [],
  "high_cardinality_dimensions": [],
  "mostly_missing_columns": [],
  "weak_variation_numeric_columns": [],
  "top_correlations": [],
  "time_series": []
}
```

Reject or downgrade columns that are:

- constant
- near-constant
- mostly missing
- free text
- identifiers
- high-cardinality dimensions unsuitable for grouping
- numeric columns with weak variation

Near-constant examples:

```text
one value takes more than 90-95% of rows
numeric CV is extremely low
all grouped totals are almost identical because of dataset structure
```

---

## 9. Row Grain Inference

Add lightweight row grain inference.

Suggested function:

```python
def infer_row_grain(profile: dict) -> str:
    ...
```

Purpose:

The model must understand what one row represents. This prevents meaningless record-count charts.

Example:

Given columns:

```text
month, institution, qualification, department, teachers, students, applications, completion_rate
```

Output:

```json
"possible_row_grain": "one monthly record per institution, qualification, and department"
```

If uncertain:

```json
"possible_row_grain": "one record per observed combination of available dimensions"
```

Rules:

- If there is one time field and several repeated dimensions, combine them.
- If a row appears to be transaction-level, say so carefully.
- If there are IDs like `order_id` or `transaction_id`, row grain may be one transaction/order.
- Do not overclaim.

This should be sent to the LLM in the compact profile.

---

## 10. Relationship Candidate Generator

Create a deterministic relationship generator.

Suggested functions:

```python
def generate_relationship_candidates(profile: dict) -> list[dict]:
    ...

def score_relationship_candidates(candidates: list[dict], profile: dict) -> list[dict]:
    ...
```

Each candidate should look like:

```json
{
  "relationship_id": "rel_001",
  "analysis_type": "trend | ranking | comparison | distribution | relationship | composition | outlier",
  "question": "How are applications changing over time?",
  "recommended_chart_type": "line",
  "x_column": "month",
  "y_column": "applications",
  "color_column": null,
  "aggregation": "sum",
  "sort": "chronological",
  "limit": null,
  "strength": "high | medium | low",
  "score": 0,
  "reason": "Applications is a metric and month spans 10 periods."
}
```

The LLM should receive only top candidates, not every possible combination.

Recommended max candidates sent to LLM:

```text
20-30
```

This controls cost.

---

## 11. Candidate Types to Generate

### 11.1 Trend candidates

For each time field + each metric/rate metric:

```text
chart_type = line
analysis_type = trend
x_column = time field
y_column = metric/rate metric
aggregation = sum for metric, mean for rate_metric
sort = chronological
```

Only generate if:

- time span has enough periods
- unique time values >= 3, preferably more
- time is not constant

Example:

```json
{
  "analysis_type": "trend",
  "question": "How are applications changing over time?",
  "recommended_chart_type": "line",
  "x_column": "month",
  "y_column": "applications",
  "aggregation": "sum",
  "sort": "chronological",
  "strength": "high"
}
```

For rate metrics:

```json
{
  "analysis_type": "trend",
  "question": "How is average completion rate changing over time?",
  "recommended_chart_type": "line",
  "x_column": "month",
  "y_column": "completion_rate",
  "aggregation": "mean",
  "sort": "chronological",
  "strength": "high"
}
```

### 11.2 Ranked comparison candidates

For each dimension + metric/rate metric:

```text
chart_type = bar
analysis_type = ranking or comparison
x_column = dimension
y_column = metric/rate metric
aggregation = sum for metric, mean for rate_metric
sort = desc
limit = 10 if dimension cardinality > 10 or 15
```

Only generate if:

- dimension is meaningful
- dimension is not identifier
- dimension is not constant/near-constant
- dimension has useful cardinality
- top_share is not too dominant, unless dominance itself is a useful insight

Example:

```json
{
  "analysis_type": "ranking",
  "question": "Which institutions drive the most applications?",
  "recommended_chart_type": "bar",
  "x_column": "institution",
  "y_column": "applications",
  "aggregation": "sum",
  "sort": "desc",
  "limit": 10,
  "strength": "high"
}
```

### 11.3 Grouped or stacked bar candidates

If chart renderer supports grouped/stacked bars, generate candidates involving two dimensions and one metric.

Pattern:

```text
dimension_1 + dimension_2 + metric
```

Example:

```json
{
  "analysis_type": "composition",
  "question": "How do applications vary by department and qualification?",
  "recommended_chart_type": "grouped_bar",
  "x_column": "department",
  "y_column": "applications",
  "color_column": "qualification",
  "aggregation": "sum",
  "sort": "desc",
  "limit": null,
  "strength": "medium"
}
```

Only generate when:

- both dimensions have manageable cardinality
- the combination does not create too many series
- the metric is meaningful

### 11.4 Distribution candidates

For each numeric metric with enough variation:

```text
chart_type = histogram
analysis_type = distribution
x_column = metric
y_column = null
aggregation = null
```

Only generate if:

- unique_count >= 10
- CV >= 0.2, or another variation threshold
- column is metric or rate_metric
- column is not an ID

Example:

```json
{
  "analysis_type": "distribution",
  "question": "How widely do application volumes vary across records?",
  "recommended_chart_type": "histogram",
  "x_column": "applications",
  "y_column": null,
  "aggregation": null,
  "sort": "none",
  "limit": null,
  "strength": "medium"
}
```

### 11.5 Box plot candidates

For each dimension + metric/rate metric:

```text
chart_type = box
analysis_type = distribution or comparison
x_column = dimension
y_column = metric/rate_metric
aggregation = null
```

Only generate if:

- dimension effective_unique between 2 and 12
- top_share <= 0.85
- y column is a metric or rate metric

Example:

```json
{
  "analysis_type": "comparison",
  "question": "How does completion rate vary across qualification levels?",
  "recommended_chart_type": "box",
  "x_column": "qualification",
  "y_column": "completion_rate",
  "aggregation": null,
  "sort": "none",
  "limit": null,
  "strength": "high"
}
```

### 11.6 Scatter relationship candidates

For correlated numeric metric pairs:

```text
chart_type = scatter
analysis_type = relationship
x_column = metric_a
y_column = metric_b
aggregation = null
```

Only generate if:

- both columns are valid metrics or rate metrics
- neither is identifier-like
- row_count >= 20
- correlation absolute value >= 0.2
- relationship makes business sense

Example:

```json
{
  "analysis_type": "relationship",
  "question": "Do student counts and applications move together?",
  "recommended_chart_type": "scatter",
  "x_column": "students",
  "y_column": "applications",
  "aggregation": null,
  "sort": "none",
  "limit": null,
  "strength": "high",
  "reason": "students and applications have a strong positive correlation."
}
```

### 11.7 Pie/composition candidates

Generate pie candidates sparingly.

Pie should only be used for meaningful part-to-whole composition.

Only generate if:

- dimension has 2-7 categories
- shares are meaningful
- not just repeated row structure
- values are not evenly repeated because of dataset design
- metric represents a meaningful total or share

Prefer bar over pie by default.

Bad pie:

```text
pie of institution row counts when every institution has 40 records
```

Good pie:

```text
share of revenue by channel
share of applications by qualification if categories represent meaningful volume shares
```

### 11.8 Correlation heatmap candidates

Generate only if:

- at least 3 valid metric/rate metric columns exist
- at least 2 correlations have absolute r >= 0.3
- columns are not identifiers

Example:

```json
{
  "analysis_type": "relationship",
  "question": "Which numeric metrics move together most strongly?",
  "recommended_chart_type": "correlation_heatmap",
  "x_column": null,
  "y_column": null,
  "color_column": null,
  "aggregation": null,
  "sort": "none",
  "limit": null,
  "strength": "medium"
}
```

---

## 12. Candidate Scoring

Add a scoring system to rank candidates before sending to LLM.

Suggested scoring factors:

### Positive score

Add score when:

- uses a real metric
- uses a rate metric correctly with mean/median/distribution
- uses meaningful dimension
- uses time as chronological axis
- trend has enough periods
- scatter has meaningful correlation
- dimension has good cardinality
- chart answers common BI question
- chart is likely executive-friendly
- chart type matches analysis type

### Negative score

Subtract score or reject when:

- column is constant or near-constant
- column is ID-like
- column is free text
- dimension is too high-cardinality
- rate metric uses sum
- time is treated as ordinary categorical bar
- count chart merely shows row structure
- pie chart shows evenly repeated categories
- weak numeric variation
- duplicate analytical question
- too many similar charts for same metric/dimension

### Strength labels

After scoring:

```text
score >= high_threshold → high
score >= medium_threshold → medium
else → low
```

Only send high and medium candidates to LLM, with a max limit.

Recommended:

```text
send top 20-30 candidates
```

If fewer candidates exist, send all valid ones.

---

## 13. KPI Candidate Generation

Add deterministic KPI candidate generation.

Suggested function:

```python
def generate_kpi_candidates(profile: dict) -> list[dict]:
    ...
```

KPI candidate schema:

```json
{
  "kpi_id": "kpi_candidate_001",
  "title": "Total Applications",
  "column": "applications",
  "aggregation": "sum",
  "business_question": "What is the total application volume?",
  "reason": "Applications is an additive business metric."
}
```

Generate:

### Additive metric KPIs

For each additive metric:

```text
sum(metric)
```

Examples:

```text
Total Revenue
Total Applications
Total Students
Total Orders
```

### Rate metric KPIs

For each rate metric:

```text
mean(rate_metric)
```

Examples:

```text
Average Completion Rate
Average Conversion Rate
Average Profit Margin
```

### Unique count KPIs

For meaningful dimensions:

```text
unique_count(dimension)
```

Examples:

```text
Number of Institutions
Number of Departments
Number of Product Categories
```

Do not use unique count KPIs for IDs unless the title is clearly a count of records/entities.

### Time-aware KPIs

If there is a valid time field:

- latest period value
- previous period value
- period-over-period change
- growth rate if supported

Example:

```text
Latest Month Applications
Applications Growth vs Previous Month
Completion Rate Change vs Previous Month
```

This can be computed by backend or left as config for renderer if not computed yet.

---

## 14. Compact LLM Planner Payload

After backend generates profile, candidates, and KPI candidates, the LLM should receive a compact payload.

Suggested payload:

```json
{
  "user_prompt": "Create a dense executive dashboard with useful metric, trend, comparison, distribution, and relationship charts. Avoid trivial row-count charts.",
  "dataset_summary": {
    "row_count": 320,
    "column_count": 8,
    "possible_row_grain": "one monthly record per institution, qualification, and department",
    "main_entities": ["institution", "qualification", "department"],
    "main_metrics": ["teachers", "students", "applications"],
    "main_rate_metrics": ["completion_rate"],
    "main_dimensions": ["institution", "qualification", "department"],
    "time_fields": ["month"],
    "excluded_fields": []
  },
  "candidate_relationships": [],
  "kpi_candidates": [],
  "current_dashboard_plan": null,
  "allowed_chart_types": [
    "bar",
    "grouped_bar",
    "stacked_bar",
    "line",
    "scatter",
    "histogram",
    "box",
    "pie",
    "correlation_heatmap"
  ],
  "output_schema": "Use the required dashboard JSON schema."
}
```

Do not send raw CSV to the LLM unless absolutely necessary.

Do not send excessive sample rows unless needed. A few sample values in the profile are enough.

---

## 15. New Compact System Prompt

Replace the long repeated planner prompt with this compact version after backend candidate generation is implemented:

```text
You are a senior BI analyst generating a Power BI-style dashboard plan for a Plotly dashboard builder.

Return strict JSON only.

Use only the dataset_summary, candidate_relationships, kpi_candidates, current_dashboard_plan, allowed_chart_types, and output schema provided. Your job is to select and organize the strongest dashboard, not to mechanically create charts from raw column types.

Choose charts that answer useful stakeholder questions about trends, rankings, comparisons, distributions, relationships, composition, or outliers.

Rules:
- Prefer high-strength candidate_relationships.
- Prefer KPI candidates that summarize the dataset clearly.
- Do not create filler charts just to reach a target count.
- Use 3-5 KPIs and 6-10 charts when supported.
- Group related charts into pages with clear objectives.
- Each chart must include business_question, analysis_type, reason_selected, aggregation, sort, and limit.
- Preserve useful existing charts during refinement unless the user asks otherwise.
- Do not output layout coordinates.
- Follow the output schema exactly.
```

This prompt should be much cheaper than the current rule-heavy prompt.

---

## 16. Updated Dashboard JSON Schema

Update the dashboard plan schema to this structure:

```json
{
  "title": "string",
  "description": "string",
  "dataset_summary": {
    "row_grain": "string",
    "main_entities": ["string"],
    "main_metrics": ["string"],
    "main_rate_metrics": ["string"],
    "main_dimensions": ["string"],
    "time_fields": ["string"],
    "excluded_fields": [
      {
        "column": "existing column name",
        "reason": "identifier | constant | near_constant | text | weak_variation | not_analytical"
      }
    ]
  },
  "kpis": [
    {
      "kpi_id": "string",
      "title": "string",
      "column": "existing column name or null",
      "aggregation": "sum | mean | median | min | max | count | unique_count",
      "business_question": "string",
      "explanation": "string"
    }
  ],
  "pages": [
    {
      "page_id": "string",
      "title": "string",
      "objective": "string",
      "chart_ids": ["string"]
    }
  ],
  "charts": [
    {
      "chart_id": "string",
      "page_id": "string",
      "title": "string",
      "business_question": "string",
      "analysis_type": "trend | ranking | comparison | distribution | relationship | composition | outlier",
      "chart_type": "bar | grouped_bar | stacked_bar | line | scatter | histogram | box | pie | correlation_heatmap",
      "x_column": "existing column name or null",
      "y_column": "existing column name or null",
      "color_column": "existing column name or null",
      "aggregation": "sum | mean | median | min | max | count | unique_count | null",
      "sort": "desc | asc | chronological | none",
      "limit": "number or null",
      "reason_selected": "string"
    }
  ],
  "insights": ["string"]
}
```

Important new fields:

```text
dataset_summary
pages
business_question
analysis_type
reason_selected
sort
limit
```

These fields make the output more useful and easier to validate/render.

---

## 17. Compatibility Adapter

If the frontend currently expects the old schema:

```json
{
  "title": "string",
  "description": "string",
  "kpis": [],
  "charts": [],
  "insights": [],
  "page_titles": []
}
```

Add an adapter:

```python
def adapt_dashboard_plan_for_legacy_frontend(plan: dict) -> dict:
    ...
```

Adapter behavior:

- Convert `pages[].title` into `page_titles`
- Keep `charts` list
- Preserve fields the renderer understands
- Ignore extra fields safely
- Ensure every chart still has required legacy fields:
  - `chart_id`
  - `title`
  - `chart_type`
  - `x_column`
  - `y_column`
  - `color_column`
  - `aggregation`
  - `explanation`

If frontend supports `page_id`, use it. If not, derive page grouping from `pages.chart_ids`.

---

## 18. Post-LLM Validation and Repair

Add validation after LLM response.

Suggested functions:

```python
def validate_dashboard_plan(plan: dict, profile: dict, candidates: list[dict]) -> list[dict]:
    ...

def repair_dashboard_plan(plan: dict, profile: dict, candidates: list[dict], errors: list[dict]) -> dict:
    ...
```

Validation should check:

### General JSON checks

- valid JSON
- required top-level fields exist
- `kpis` is list
- `charts` is list
- `pages` is list
- `insights` is list

### Column checks

For each chart:

- `x_column` exists if not null
- `y_column` exists if not null
- `color_column` exists if not null
- no chart references excluded fields
- no chart uses ID field as grouping unless count/unique_count makes sense

### Chart type checks

- chart type is allowed
- line chart has time x-axis
- bar chart has dimension or time only if valid
- scatter has two valid numeric metric/rate metric axes
- histogram has numeric metric/rate metric target
- box has dimension x-axis and metric/rate metric y-axis
- pie has meaningful dimension and valid aggregation
- heatmap has enough valid metric correlations

### Aggregation checks

- aggregation is allowed
- additive metrics can use sum, mean, median, min, max
- rate metrics cannot use sum
- identifiers cannot use sum/mean as metric values
- dimensions cannot be y-values except for count/unique_count

### Page checks

- every chart has `page_id`
- every `page_id` exists in pages
- every `chart_id` referenced by pages exists
- no duplicate chart IDs
- no empty page unless acceptable

### Repair behavior

Do not fail the whole dashboard if one chart is invalid.

Repair strategy:

1. If rate metric uses sum, change aggregation to mean.
2. If chart references invalid/excluded column, remove the chart.
3. If chart type is invalid but candidate relationship is valid, map to candidate recommended chart type.
4. If there are too few charts, replace removed charts with next unused high-strength candidate.
5. If a page becomes empty, remove the page.
6. If a chart has missing page_id, assign it to the most relevant existing page or create a fallback page.
7. Ensure final plan remains renderable.

---

## 19. Cost Reduction Strategy

The product is intended to be sold, so LLM cost per dashboard matters.

### Main cost reductions

1. Do not send raw CSV to LLM.
2. Send compact `dataset_summary`, not full verbose profile.
3. Send only top 20-30 relationship candidates.
4. Generate chart candidates deterministically in backend.
5. Generate KPI candidates deterministically in backend.
6. Move long chart rules out of user payload.
7. Use a compact system prompt.
8. Use structured outputs / JSON schema mode if supported by the LLM API.
9. Validate and repair JSON in backend instead of reprompting when possible.
10. Avoid asking the LLM to produce layout coordinates.
11. Cache dataset profiles by file hash.
12. Cache candidate relationships by profile hash.
13. Cache LLM dashboard plans for identical user prompt + dataset profile + candidate set.

### Suggested caching keys

```text
dataset_hash = hash(file contents)
profile_hash = hash(compact profile)
candidate_hash = hash(candidate_relationships + kpi_candidates)
planner_cache_key = hash(user_prompt + profile_hash + candidate_hash + current_dashboard_plan_hash)
```

### Avoid repeated LLM calls

If validation fails lightly, repair in backend.

Only reprompt if:

- JSON is completely invalid
- plan is empty
- the user explicitly asks for major refinement
- all charts fail validation

---

## 20. Local LLM / Ollama Consideration

The product may later support local/private mode using Ollama, but this should not be the default engine initially.

Reason:

The difficult part is not JSON generation. The difficult part is semantic BI reasoning:

```text
understand row grain
classify metrics vs IDs
infer useful relationships
avoid trivial charts
select dashboard-level story
```

Laptop-runnable local models can handle basic chart selection if the backend already generates high-quality candidates. They are less reliable if asked to infer everything from scratch.

Recommended strategy:

```text
Default mode: cloud LLM planner for high quality
Optional later: local Ollama private mode using the same candidate_relationship payload
```

For local mode, reduce LLM job even further:

```text
LLM only ranks/selects from candidates and writes titles/explanations
```

Do not rely on browser-only local models for full BI planning.

---

## 21. Example Target Behavior

Example dataset:

```text
month
institution
qualification
department
teachers
students
applications
completion_rate
```

Expected roles:

```json
{
  "month": "time",
  "institution": "dimension",
  "qualification": "dimension",
  "department": "dimension",
  "teachers": "metric",
  "students": "metric",
  "applications": "metric",
  "completion_rate": "rate_metric"
}
```

Expected aggregations:

```json
{
  "teachers": "sum",
  "students": "sum",
  "applications": "sum",
  "completion_rate": "mean"
}
```

Expected row grain:

```text
one monthly record per institution, qualification, and department
```

Expected good relationships:

```text
applications over month → line
students over month → line
average completion_rate over month → line
applications by institution → ranked bar
students by institution → ranked bar
average completion_rate by qualification → bar or box
completion_rate by department → bar or box
students vs applications → scatter if correlation supported
teachers vs applications → scatter if correlation supported
applications by department and qualification → grouped/stacked bar if supported
completion_rate distribution → histogram/box if supported
```

Expected bad relationships:

```text
count by institution if every institution has equal rows
pie of institution row counts if it only shows dataset structure
bar chart of month as categorical count
sum of completion_rate
treating students as an ID
using IDs/codes as x-axis categories
```

---

## 22. Implementation Checklist

### Step 1: Inspect current codebase

Find:

- CSV upload endpoint
- dataset profiling function/module
- LLM prompt construction
- LLM call wrapper
- dashboard JSON parsing
- chart rendering logic
- layout packing logic
- frontend schema expectations

### Step 2: Add or improve profile module

Implement:

```python
profile_dataset(df)
infer_column_roles(df, raw_profile)
compute_data_quality(df, profile)
infer_row_grain(profile)
```

### Step 3: Add semantic role correction

Implement robust role overrides based on:

- column name
- inferred dtype
- unique count
- top share
- numeric variation
- sample values
- ID-like patterns
- metric-like terms
- rate-like terms
- time-like terms

### Step 4: Add relationship generator

Implement:

```python
generate_relationship_candidates(profile)
```

Candidate types:

- trends
- ranked bars
- grouped/stacked bars
- histograms
- box plots
- scatter plots
- pie/composition candidates
- heatmaps

### Step 5: Add candidate scoring/filtering

Implement:

```python
score_relationship_candidates(candidates, profile)
filter_top_candidates(candidates, max_candidates=30)
```

### Step 6: Add KPI candidates

Implement:

```python
generate_kpi_candidates(profile)
```

### Step 7: Compact planner payload

Implement:

```python
build_compact_planner_payload(
    user_prompt,
    profile,
    candidate_relationships,
    kpi_candidates,
    current_dashboard_plan=None
)
```

### Step 8: Replace prompt

Use the compact planner system prompt from this document.

### Step 9: Update schema or add adapter

If frontend supports new schema, use it directly.

If frontend expects old schema, add compatibility adapter.

### Step 10: Add validation/repair

Implement:

```python
validate_dashboard_plan(plan, profile, candidates)
repair_dashboard_plan(plan, profile, candidates, errors)
```

### Step 11: Add caching

Cache:

- file hash
- dataset profile
- candidate relationships
- LLM plan if identical inputs

### Step 12: Test with known datasets

Test with:

- education dataset
- sales dataset
- pure categorical dataset
- time-series dataset
- dataset with IDs
- dataset with rate columns
- dataset with no useful metrics
- dataset with high-cardinality categories
- dataset with constant columns

---

## 23. Suggested Test Cases

### Test 1: Education dataset

Columns:

```text
month, institution, qualification, department, teachers, students, applications, completion_rate
```

Assertions:

```text
students is metric, not ID
completion_rate is rate_metric with mean
year/month fields are time fields
no sum completion_rate chart
no count-by-institution chart if counts are equal
applications over time line exists
applications by institution bar exists
```

### Test 2: Sales dataset

Columns:

```text
order_id, order_date, region, category, sales, profit, discount, quantity
```

Assertions:

```text
order_id is identifier
order_date is time
sales/profit/quantity are metrics
discount may be rate_metric or metric depending values
sales over time exists
sales by region/category exists
profit by category exists
order_id is not chart x-axis
```

### Test 3: Rate dataset

Columns:

```text
date, channel, impressions, clicks, ctr, conversion_rate
```

Assertions:

```text
ctr and conversion_rate use mean
impressions and clicks use sum
ctr over time uses mean
no sum ctr KPI
```

### Test 4: ID-heavy dataset

Columns:

```text
customer_id, transaction_id, product_code, date, amount
```

Assertions:

```text
customer_id/transaction_id/product_code are identifiers
amount is metric
no bar chart by transaction_id
unique customer count KPI may exist
amount over time exists
```

### Test 5: Weak metric dataset

Columns:

```text
name, email, status, signup_date
```

Assertions:

```text
no fake metric charts
count by status may be valid
signup trend may be valid
email/name excluded as text/identifier
```

---

## 24. Final Coding Agent Instruction

Use this instruction when implementing:

```text
Refactor the backend so chart validity and relationship generation happen before the LLM call. The LLM should no longer infer every possible chart from raw column metadata. It should receive a compact dataset summary, KPI candidates, and top relationship candidates, then select and organize the strongest dashboard JSON.

Preserve the current user-facing behavior, but improve quality and reduce token cost. Add compatibility adapters if the frontend still expects the old schema.

Do not remove deterministic layout packing. The LLM should not output layout coordinates.

Prioritize correctness for semantic role detection, especially:
- students = metric, not ID
- completion_rate = rate_metric, mean aggregation
- year/month/date = time, not ordinary category
- IDs/codes are not chart dimensions
- rates are never summed
```

---

## 25. Success Criteria

The refactor is successful if:

1. The LLM prompt becomes much shorter.
2. The LLM receives top chart candidates instead of needing to invent everything.
3. Token usage per dashboard decreases.
4. Dashboard quality becomes more consistent.
5. Random/trivial charts become rare.
6. Rate metrics are not summed.
7. ID-like columns are not used as chart dimensions.
8. Time fields are used chronologically.
9. Backend can repair minor LLM mistakes without reprompting.
10. The product becomes more viable to sell because per-dashboard cost is controlled.
