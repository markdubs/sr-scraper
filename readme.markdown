# Web Scraper for College Rankings

This project is a Node.js script that uses Puppeteer to scrape the table displayed on the ranking website. The script navigates to the page, interacts with the website's UI to select different subjects, and then scrapes the data from the displayed table.

## Requirements

- Node.js
- Puppeteer (`npm install puppeteer`)

## Usage

1. Clone the repository.
2. Install the dependencies with `npm install`.
3. Run the script with `node scraper.js [--year] [--output] [--format]`.

The script takes three optional command line arguments. The first is the year of rankings, which defaults to `2023`. The second is the destination where the scraped data will be written. And the third is the format (JSON or CSV) If no argument is provided, the data will be written to `./output/rankings-<YEAR>.<FORMAT>`.

## How it Works

The script first navigates to the initial page of the ranking website. It then clicks on the subject selector and waits for the subject tooltip to become visible. Once the tooltip is visible, the script gets the full list of subjects.

For each subject, the script navigates to the corresponding page and scrapes the data from the table. The data is then written to the specified output file in JSON format.

## Note

This script is intended for educational purposes only. Please respect the terms of service of the ranking website you are using.