# Flat Price Prediction – DevOps for ML Web Application

This project was developed for **ST1516: DevOps and Automation for AI (DOAA)** under the **School of Computing, Singapore Polytechnic**.  
It demonstrates a **complete end-to-end Machine Learning web application** built using **Flask**, integrating an ML regression model, SQLite database, REST APIs, testing, and DevOps best practices (SCM, CI/CD, and automation).

---

## Overview

This web application predicts **HDB resale flat prices** using a trained regression model.  
It integrates:
- A **Jupyter-based ML notebook** for model training  
- A **Flask web backend** for serving predictions  
- A **SQLite database** for storing prediction history  
- **DevOps practices** for version control, CI/CD, and automated testing

The project demonstrates:
- **Infrastructure as Code (IaC)** using GitLab SCM & branches  
- **Continuous Integration (CI)** via unit testing and API validation  
- **Continuous Delivery (CD)** with a production-ready Flask system  

---

## Key Features

### Machine Learning
- Regression-based model trained on Singapore flat resale data  
- Feature engineering: lease age, storey midpoint, floor area, remaining lease  
- Models trained: Linear, Ridge, Lasso, Decision Tree, Random Forest, Gradient Boosting  
- Auto-comparison by RMSE, MAE, R²  
- Best model exported as `flat_price_prediction_model.pkl`  

### Web Application (Flask)
- Login authentication for access control  
- Prediction form integrated with the trained model  
- SQLite database to store prediction history  
- Table view for displaying all previous predictions  
- Clean UI with templates and CSS styling  

### Testing & DevOps
- Unit testing covers:
  - Validity testing  
  - Range testing  
  - Consistency testing  
  - Expected & unexpected failure cases  
- REST API routes:
  - `/predict` – prediction endpoint  
  - `/profile` – view and update account details, prediction history  
  - `/login` – secure login  
  - `/logout` – end the authenticated session  
- GitLab Workflow:
  - 6-branch structure  
  - SCRUM board setup  
  - Merge workflow with CI pipeline  

---

## Project Structure

```
📦 Flat-Price-Prediction
│
├── app.py                        # Main Flask app entry point
├── model/
│   ├── flat_price_prediction_model.pkl
│   └── model_usage_helper.txt
│
├── templates/
│   ├── index.html
│   ├── history.html
│   └── login.html
│
├── static/
│   └── style.css
│
├── tests/
│   ├── test_app.py
│   ├── test_validity.py
│   ├── test_consistency.py
│   └── test_failures.py
│
├── data/
│   └── Flat prices.csv
│
├── notebooks/
│   └── Flat_Price_Regression_Pipeline.ipynb
│
├── database.db
├── requirements.txt
└── README.md
```

---

## Setup Instructions

### 1. Clone the Repository
```bash
git clone https://gitlab.com/CA1-DAAA2B0X-<AdminID>-<Name>.git
cd Flat-Price-Prediction
```

### 2. Create a Virtual Environment
```bash
python -m venv venv
venv\Scripts\activate          # Windows
# or
source venv/bin/activate       # macOS/Linux
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

Key dependencies:
- Flask  
- pandas  
- numpy  
- scikit-learn  
- matplotlib  
- seaborn  
- pytest  
- sqlite3 (built-in)

### 4. Configure API keys (chatbot)
Create a `.env` file in the project root and provide your OpenAI credentials:

```env
OPENAI_API_KEY=replace-with-your-openai-api-key
OPENAI_CHAT_MODEL=gpt-4o-mini   # optional override
```

The HDB Resale Copilot button only appears when an API key is present. Context snippets for the assistant live in `application/resources/chatbot_context.txt`; feel free to extend the RAG knowledge base there.

---

## Running the Flask App

### Start the Server
```bash
python app.py
```

### Open in Browser
Visit:
```
http://127.0.0.1:5000/
```

Login with your credentials, input flat details, and view the predicted price and stored history.

---

## Running Unit Tests

Run all test cases:
```bash
pytest tests/
```

Includes:
- Validation of API responses  
- Consistency and range checks  
- Error handling (expected and unexpected cases)

---

## DevOps Implementation

### GitLab Branch Workflow
| Branch | Purpose |
|---------|----------|
| `main` | Final merged stable version |
| `data-preprocessing` | Data cleaning and feature engineering |
| `model-training` | ML training and evaluation |
| `flask-backend` | API and prediction logic |
| `frontend-ui` | HTML/CSS frontend |
| `testing` | Unit and API tests |

### SCRUM Board Setup
- Managed under GitLab Issue Board  
- Each sprint corresponds to a branch milestone  
- Merge requests ensure review before integration  

### CI/CD Concept
- Code pushed to GitLab triggers automatic builds and tests (CI)  
- Flask app structured for containerized or Render deployment (CD-ready)

---

## Machine Learning Model Summary

| Model | Test RMSE | Test MAE | R² |
|--------|------------|----------|----|
| Linear Regression | 58,000 | 42,000 | 0.85 |
| Ridge Regression | 57,500 | 41,500 | 0.86 |
| Random Forest | **44,000** | **31,000** | **0.91** |
| Gradient Boosting | 46,000 | 33,000 | 0.90 |

Selected Model: Random Forest Regressor  
Serialized to: `flat_price_prediction_model.pkl`

---

## Database Schema (SQLite)

| Field | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| town | TEXT | Town name |
| flat_type | TEXT | Flat type (e.g., 4 ROOM) |
| floor_area_sqm | REAL | Floor area in sqm |
| flat_model | TEXT | Flat model name |
| lease_commence_date | INTEGER | Lease start year |
| predicted_price | REAL | Model output |
| date | TEXT | Prediction date |

---

## Deliverables Summary (CA1 Requirements)

| Component | Description | Marks |
|------------|--------------|-------|
| DevOps Process | GitLab, branches, SCRUM board | 10 |
| Model Development | Feature engineering, regression model | 10 |
| Frontend Development | Flask UI, wireframes, styling | 20 |
| Backend Development | Flask routes, SQLite, login | 25 |
| Automatic Testing | Unit tests, REST API testing | 20 |
| Presentation | PowerPoint, demo walkthrough | 15 |
| Deployment (Bonus) | Optional Render deployment | +5 |

---

## Deployment (Optional)

To deploy the app online (bonus section):
- Create a free account at [Render](https://render.com/)
- Add repository and configure:
  - Start Command: `python app.py`
  - Environment: Python 3.11
  - Build Command: `pip install -r requirements.txt`
- Ensure `database.db` and model `.pkl` files are included.

---

## References

- AWS DevOps Concepts – [https://aws.amazon.com/devops/what-is-devops/](https://aws.amazon.com/devops/what-is-devops/)  
- Kaggle Property Datasets – [https://www.kaggle.com/datasets?search=property](https://www.kaggle.com/datasets?search=property)  
- Singapore Polytechnic – ST1516 CA1 Brief (2025/2026 S2)

---

## Author Information

**Name:** Ng Yu Hang (Mervin)  
**Admission No:** [student-id]
**Class:** DAAA2A23
**Module:** ST1516 DevOps and Automation for AI  
**Semester:** 2025/2026 Semester 2  

---

## How to Run Everything (Quick Commands)

```bash
# Clone project
git clone https://gitlab.com/CA1-DAAA2B0X-<AdminID>-<Name>.git
cd Flat-Price-Prediction

# Set up environment
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Run Flask web app
python app.py

# Run test suite
pytest tests/
```

---

### Summary
This project integrates ML model training, Flask deployment, and DevOps automation to form a production-ready predictive system — demonstrating the entire DevOps for Machine Learning lifecycle from data processing to web deployment.

