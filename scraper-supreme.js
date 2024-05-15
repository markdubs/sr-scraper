import puppeteer from 'puppeteer';
import fs from 'fs';
import { exit } from 'process';


const args = process.argv.slice(2);

// Default values
let year = null;
let outputDestination = null;
let format = 'json';

args.forEach(arg => {
    const [key, value] = arg.split('=');
    if (key === '--year') {
        year = value;
    } else if (key === '--output') {
        outputDestination = value;
    } else if (key === '--format') {
        format = value;
    }
});

if (format !== 'json' && format !== 'csv') {
    console.error('Invalid format. Must be either "json" or "csv".');
    exit(1);
}

if (isNaN(year) || year < 2017 || year > 2023) {
    console.error('Invalid year. Must be an integer between 2017 and 2023.');
    exit(1);
}

if (!outputDestination) {
    outputDestination = './output/rankings' + (year ? '-' + year : '') + '.' + format;
}


const pageBase = 'https://www.shanghairanking.com/rankings/gras/';


console.log('Starting up...');
const browser = await puppeteer.launch();
let page = await browser.newPage();

// Load the first page
await page.goto(pageBase + '2023/RS0101', {waitUntil: 'domcontentloaded', timeout: 0});

const nuxt = await loadNuxt();

let subjectInfo = [];

nuxt.data[0].subjectList.forEach(category => {
    category.detail.forEach(subject => {
        subjectInfo.push({
            category: category.nameEn,
            name: subject.nameEn,
            code: subject.code,
            versions: subject.versions.split(','),
        });
    });
});

console.log(subjectInfo);
// exit(0);

const indList = nuxt.data[0].indList;
console.log(indList);


let allData = [];

for (let i = 0; i < subjectInfo.length; i++) {
    let subject = subjectInfo[i];

    if (year) {
        let data = await retrieveData(subject, year);
        allData = allData.concat(data);
    } else {
        for (let j = 0; j < subject.versions.length; j++) {
            let data = await retrieveData(subject, subject.versions[j]);
            allData = allData.concat(data);
        };
    }
}


let outputText = '';

if (format === 'csv') {
    outputText = 'Year,Category,Subject,Ranking,Name,Region,Score,';
    indList.forEach(ind => {
        outputText += ind.nameEn + ',';
    });
    outputText += '\n';

    console.log(outputText);

    allData.forEach(category => {
        category.table.forEach(subject => {
            let rowData = [
                sanitize(category.version),
                sanitize(category.category),
                sanitize(category.subject),
                sanitize(subject.ranking),
                sanitize(subject.name),
                sanitize(subject.region),
                sanitize(subject.score),
                ...Object.values(subject.indData).map(ind => sanitize(ind)),
            ]

            outputText += rowData.join(',') + '\n';
        });
    });
} else {
    outputText = JSON.stringify(allData);
}

fs.writeFileSync(outputDestination, outputText);
console.log(`Data written to ${outputDestination} in ${format} format.`);

// Done, close the browser
await browser.close();









function sanitize(str)
{
    return ('"' + str + '"').replace(/(\n|\r|\t)/g, '');
}

async function loadNuxt()
{
    let nuxt = null;

    while (!nuxt) {
        // Examine the __NUXT__ object
        nuxt = await page.evaluate(() => {
            return window.__NUXT__;
        });

        if (!nuxt.data || !nuxt.data[0] || !nuxt.data[0].subjectList) {
            nuxt = null;
        }
    }

    return nuxt;
}


async function retrieveData(subject, version)
{
    let retrievedData = [];

    const url = pageBase + version + '/' + subject.code;
    console.log(subject.category + "\t" + subject.name + "\t" + version + "\t" + subject.code);

    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 0});
    const nuxt = await loadNuxt();

    const subjectData = nuxt.data[0].deepUnivData;

    let count = 0;

    // console.log(subjectData);

    subjectData.forEach((tablePage) => {
        let fullTable = [];
        tablePage.forEach((university) => {
            fullTable.push({
                ranking: university.ranking,
                name: university.univNameEn,
                region: university.region,
                score: university.score,
                indData: Object.values(university.indData),
            });
        });

        retrievedData.push({
            category: subject.category,
            subject: subject.name,
            version: version,
            table: fullTable,
        });

        count++;
    });

    return retrievedData;
}