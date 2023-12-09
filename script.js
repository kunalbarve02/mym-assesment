import exec from 'child_process';
import * as chromeLauncher from 'chrome-launcher';
import PromptSync from 'prompt-sync';
import puppeteer from 'puppeteer';
import AWS from 'aws-sdk';
const { SecretsManager } = AWS;
const secretsManager = new SecretsManager({
    region: 'ap-south-1',
});

const checkChromium = async () => {
    try {
        const data = await exec.execSync('chromium-browser --version');
        console.log('Chromium is installed.');
    }
    catch (error) {
        console.log('Chromium is not installed. Installing it now...');
        try {
            await exec.execSync('sudo apt-get update');
            await exec.execSync('sudo apt-get install chromium-browser');
            console.log('Chromium is installed.');
        } catch (error) {
            console.error(error);
        }
    }
};

const addSecret = async (socialMediaName, email, password) => {
    try {
        const data = await secretsManager.createSecret({
            Name: socialMediaName + '-' + email,
            SecretString: password
        }).promise();
        console.log(data);
    } catch (error) {
        console.error(error);
    }
};

const getSecret = async (socialMediaName, email) => {
    try {
        const data = await secretsManager.getSecretValue({
            SecretId: socialMediaName + '-' + email,
        }).promise();
        return data.SecretString;
    } catch (error) {
        console.log('Ypur password is not added to AWS Secrets Manager. Adding it now...');
    }
}

const openChromiumAndLogin = async (socialMediaName, email, password) => {
  if (!socialMediaName) {
    console.log('Please enter a social media site before launching Chromium.');
    return;
  }
  await checkChromium();

  const socialMediaSelectors = {
    facebook: {
        email: '#email',
        password: '#pass',
        loginButton: 'button[name="login"]',
    },
    instagram: {
        email: 'input[name="username"]',
        password: 'input[name="password"]',
        loginButton: 'button[type="submit"]',
    },
    linkedin: {
        email: '#session_key',
        password: '#session_password',
        loginButton: 'button[type="submit"]',
    },
  }
  try {
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: await chromeLauncher.launch({
            chromeFlags: [
            '--window-size=1920,1080',
            '--disable-extensions',
            '--proxy-server=\'direct://\'',
            '--proxy-bypass-list=*',
            '--start-maximized'
            ],
        }).then(chrome => chrome.executablePath),
        });
    const page = await browser.newPage();
    console.log(`Opening ${socialMediaName} in Chromium...`);
    await page.goto(`https://${socialMediaName}.com`);
    await page.type(socialMediaSelectors[socialMediaName].email, email);
    await page.type(socialMediaSelectors[socialMediaName].password, password);
    await page.click(socialMediaSelectors[socialMediaName].loginButton);
  } catch (error) {
    console.error(`Error launching Chromium: ${error.message}`);
  }
};

const availableSocialMediaSites = [
  'facebook',
  'instagram',
  'linkedin',
];


console.log('Available social media sites: ');
console.log(availableSocialMediaSites.join(', '));
console

const prompt = new PromptSync();
const socialMediaName = prompt('Enter a social media site: ');
if(!socialMediaName) {
  console.log('Please enter a social media site.');
  process.exit(1);
}
if(!availableSocialMediaSites.includes(socialMediaName.toLowerCase())) {
  console.log('Please enter a valid social media site.');
  process.exit(1);
}
const email = prompt('Enter your email: ');
if(!email) {
  console.log('Please enter your email.');
  process.exit(1);
}

getSecret(socialMediaName, email)
    .then((secret) => {
        if (!secret) {
            const password = prompt.hide('Enter your password: ');
            if(!password) {
                console.log('Please enter your password.');
                process.exit(1);
            }
            addSecret(socialMediaName, email, password);
            openChromiumAndLogin(socialMediaName, email, password);
        } else {
            openChromiumAndLogin(socialMediaName, email, secret);
        }
    })
    .catch((error) => {
        console.error(error);
    });
