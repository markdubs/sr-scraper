// This nodejs script uses puppeteer to scrape the table displayed on https://www.shanghairanking.com/rankings/gras/2023/RSXXXX

import { exit } from 'process';
import puppeteer from 'puppeteer';

import fs from 'fs';

// Get the output destination as a command line argument
const outputDestination = process.argv[2] || 'rankings-data.json';

// Set the first page
let currentPage = 'https://www.shanghairanking.com/rankings/gras/2023/RS0101';

(async () => {
    console.log('Starting up...');
    const browser = await puppeteer.launch();
    let page = await browser.newPage();

    // Load the first page
    await page.goto(currentPage, {waitUntil: 'domcontentloaded', timeout: 0});

    // Click on the subject selector
    const subjectSelector = await page.$('#rank-content div.subject-select');
    await subjectSelector.click();

    // Wait for the subject tooltip to be visible so we can click on items in the dropdown
    await page.waitForSelector('#rank-content div.subj-tooltip', {visible: true});

    await page.waitForSelector('#rank-content div.options-container');

    // Get the full list of subjects
    const subjects = await getSubjectInfo(page);

    // Extract all of the data from each subject
    let fullData = await getSubjectData(page, subjects);

    // Done, close the browser
    await browser.close();

    // Store all the data in a JSON file
    fs.writeFileSync(outputDestination, JSON.stringify(fullData));
    console.log(`Data written to ${outputDestination}`);
})();

// Helper function for grabbing the data from the current table on the page
async function scrapeTable(page) 
{
    return await page.evaluate(() => {
        const table = document.querySelector('table.rk-table');
        const headers = Array.from(table.querySelectorAll('th')).map(th => {
            if (th.innerText === '') {
                // If the th has no innerText, get the value of the input element
                return th.querySelector('input').value;
            } else {
                // Remove any leading or trailing whitespace/tabs
                
                return th.innerText.replace("\t", '').trim();
            }
        });
        const rows = Array.from(table.querySelectorAll('tr')).map(row => {
            return Array.from(row.querySelectorAll('td')).map(td => {
                const innerText = td.innerText

                // If innerText is blank, we check for a child element div.region-img. That element has
                // a style attribute that contains the background image url. We extract the url, and return
                // a substring of the url, starting from the last slash, and ending before the last period.
                if (innerText === '') {
                    const img = td.querySelector('div.region-img');
                    if (img) {
                        const style = img.getAttribute('style');
                        // console.log(style);
                        const url = style.match(/url\((.*?)\)/)[1];
                        // console.log(url);
                        return url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('.')).toUpperCase();
                    }
                } else {
                    return innerText;
                }
            });
        });

        // Remove any empty rows
        return {headers, rows: rows.filter(row => row.length > 0)};
    });
}

// Helper function for scraping all pages of a table
async function scrapeAllPagesOfTable(page) 
{
    let table = await scrapeTable(page);

    let count = 1;

    let nextButton = await page.$('li.ant-pagination-next:not(.ant-pagination-disabled) > a');

    while (nextButton) {
        count++;
        await nextButton.evaluate(el => el.click());
        await page.waitForSelector('table.rk-table');
        
        const newTable = await scrapeTable(page);
        table.rows = table.rows.concat(newTable.rows);

        nextButton = await page.$('li.ant-pagination-next:not(.ant-pagination-disabled) > a');
    }

    console.log(`Scraped ${count} pages`);

    return table;
}

async function getSubjectInfo(page)
{
    console.log('Scanning for general categories...');
    // Get the general categories
    const generalCategories = await page.evaluate(() => {
        const ul = document.querySelector('#rank-content ul.options');
        return Array.from(ul.querySelectorAll('li')).map(li => li.innerText);
    });
    
    let subjects = [];

    console.log('Scanning for subjects...');
    // For each category, get the specific subjects
    for (let i = 0; i < generalCategories.length; i++) {
        const generalCategory = generalCategories[i];

        const generalCategoryElement = await page.$(`#rank-content ul.options > li:nth-child(${i + 1})`);
        await generalCategoryElement.hover();

        // Wait for the general category element to get the class `select-active`
        await page.waitForFunction(`document.querySelector('#rank-content ul.options > li:nth-child(${i + 1})').classList.contains('select-active')`);

        const specificSubjects = await page.evaluate(() => {
            const childOptions = document.querySelector('#rank-content div.child-options');
            return Array.from(childOptions.querySelectorAll('li')).map(li => li.innerText);
        });

        subjects.push({generalCategory, specificSubjects});
    }

    return subjects;
}


async function getSubjectData(page, subjects)
{
    console.log('Scraping data for each subject...');
    console.log('---------');

    let fullData = [];

    for (let i = 0; i < subjects.length; i++) {
        for (let j = 0; j < subjects[i].specificSubjects.length; j++) {
            console.log(subjects[i].generalCategory + " - " + subjects[i].specificSubjects[j]);

            await page.goto(currentPage, {waitUntil: 'domcontentloaded', timeout: 0});

            const subjectSelector = await page.$('#rank-content div.subject-select');
            await subjectSelector.click();

            await page.waitForSelector('#rank-content div.subj-tooltip', {visible: true});

            // Wait for the options container to appear
            await page.waitForSelector('#rank-content div.options-container');

            // Now hover over the appropriate general category
            const generalCategoryElement = await page.$(`#rank-content ul.options > li:nth-child(${i + 1})`);
            await generalCategoryElement.hover();

            // Wait for the general category element to get the class `select-active`
            await page.waitForFunction(`document.querySelector('#rank-content ul.options > li:nth-child(${i + 1})').classList.contains('select-active')`);

            // Now click on the specific subject corresponding to j. Since there can be multiple uls containing the subjects,
            // we need to just get all the lis in a list first and then click on the jth one.
            let allSpecificSubjectElements = await page.$$('#rank-content div.child-options li');
            const specificSubjectElement = allSpecificSubjectElements[j];

            if (i === 0 && j === 0) {
                // console.log('Skipping clicking on the first subject');
            } else {
                await specificSubjectElement.click();

                // Wait for the new page to load
                await page.waitForNavigation({waitUntil: 'domcontentloaded'});
            }

            const data = await scrapeAllPagesOfTable(page);

            fullData.push({
                category: subjects[i].generalCategory, 
                subject: subjects[i].specificSubjects[j], 
                url: page.url(),
                data
            });

            console.log('---------');
        }
    }

    return fullData;
}