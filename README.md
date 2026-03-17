\# Claude-9: Flight Tracker



\## Overview

Claude-9 is a data-driven flight planning system designed to help travelers make informed decisions by analyzing flight prices, weather conditions, and cancellation risks. 



Unlike traditional platforms, this system provides \*\*actionable insights\*\*, including fare drop predictions and airline reliability metrics, enabling users to balance cost and travel risk effectively.



\---



\## My Contributions (Backend \& Database Engineering)

\- Designed and implemented a \*\*normalized relational database schema\*\*

\- Developed advanced \*\*stored procedures, triggers, and transactions\*\*

\- Built backend logic to support:

&#x20; - Fare drop analysis

&#x20; - Weather and cancellation insights

\- Ensured \*\*data integrity and consistency\*\* through transaction management

\- Optimized complex queries using \*\*joins, aggregations, and subqueries\*\*



\---



\## Key Features



\###  Fare Drop Report

\- Detects flights with ≥10% price drop

\- Highlights potential savings for users

\- Prioritizes high-demand flights



\###  Weather \& Cancellation Insights

\- Analyzes airline reliability based on weather patterns

\- Provides cancellation risk metrics

\- Helps users balance \*\*price vs reliability\*\*



\###  Smart Recommendations

\- Suggests alternative flights based on:

&#x20; - Price trends

&#x20; - Weather conditions

&#x20; - Historical data



\---



\## Database Engineering Highlights



\### 🔹 Stored Procedure: `GenerateFareDropReport()`

\- Generates:

&#x20; - Fare drop insights

&#x20; - Airline reliability reports

\- Combines multiple datasets using optimized queries



\### 🔹 Transaction Management

\- Ensures atomic updates across:

&#x20; - Flights

&#x20; - Weather data

&#x20; - Fare history

\- Prevents inconsistent or partial data



\###  Trigger: `update\_total\_ops\_after\_fare`

\- Automatically updates flight statistics

\- Maintains real-time data consistency



\###  Schema Design

\- Fully normalized relational schema

\- Key improvements:

&#x20; - `Fare\_History` linked to `Flight` (not Airport)

&#x20; - Added `User roles` and authentication fields

&#x20; - Introduced `quarter` attribute for better trend analysis



\---



\## Tech Stack

\- Backend: Python (Flask)

\- Database: MySQL

\- Tools: SQL Workbench

\- Concepts: Normalization, Transactions, Stored Procedures, Triggers



\---



\## Example Insight

When searching for flights (e.g., JFK → LAX):

\- "Flight DL1234 dropped 15.6% to $380"

\- "United: 23% weather disruption, Delta: 12%"



&#x20;Users can choose between \*\*cheaper vs more reliable options\*\*



\---



\## Challenges \& Learnings

\- Debugged complex backend serialization issues between SQL and Flask

\- Learned importance of:

&#x20; - Data structure handling in Python

&#x20; - Database-driven computation vs application logic

\- Improved system reliability through database-level optimizations



\---



\## Future Improvements

\- Add real-time price alerts

\- Implement user profiles and saved searches

\- Integrate graph database (Neo4j) for route optimization

\- Build full booking system with payment integration



\---



\## Impact

Claude-9 enhances travel planning by transforming raw data into actionable insights, helping users make smarter, safer, and more cost-effective decisions.

