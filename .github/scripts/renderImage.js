const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const mustache = require('mustache');

class ImageGenerator {
    constructor(templatesPath) {
        this.templatesPath = templatesPath;
    }

    getImageDataUrl(backgroundImage) {
        const imagePath = path.join(this.templatesPath, backgroundImage);
        const imageBuffer = fs.readFileSync(imagePath);
        return `data:image/png;base64,${imageBuffer.toString('base64')}`;
    }

    getIconDataUrl(iconName, color = '#6E7681') {
        const iconPath = path.join(this.templatesPath, 'assets', 'icons', `${iconName}.svg`);
        let iconContent = fs.readFileSync(iconPath, 'utf8');
        iconContent = iconContent.replace(/<path/g, `<path fill="${color}"`);
        return `data:image/svg+xml;base64,${Buffer.from(iconContent).toString('base64')}`;
    }

    getFontDataUrl() {
        const fontPath = path.join(this.templatesPath, 'assets', 'fonts', 'MonaSansVF-Regular.woff2');
        const fontBuffer = fs.readFileSync(fontPath);
        return `data:font/woff2;base64,${fontBuffer.toString('base64')}`;
    }

    renderTemplate(data, baseURL) {
        const templatePath = path.join(baseURL, data.template_file_name);
        const template = fs.readFileSync(templatePath, 'utf8');
        const iconColor = '#f7f7f8';
        data.background_image = this.getImageDataUrl(data.background_image);
        data.star_icon = this.getIconDataUrl('star', iconColor);
        data.fork_icon = this.getIconDataUrl('repo-forked', iconColor); 
        data.contributors_icon = this.getIconDataUrl('people', iconColor);
        data.issue_icon = this.getIconDataUrl('issue-opened', iconColor); // Add issue icon
        data.discussion_icon = this.getIconDataUrl('comment-discussion', iconColor); // Add discussion icon
        data.font_url = this.getFontDataUrl();
        data.baseURL = baseURL;
        data.language_distribution = data.language_distribution || [];
        data.profile_picture = data.profile_picture_url;
        return mustache.render(template, data);
    }

    async generateImage(html, baseURL, headless = true, keepOpen = false) { // Add keepOpen parameter
        const browser = await puppeteer.launch({
            defaultViewport: { width: 1280, height: 640, deviceScaleFactor: 1 },
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files', '--enable-local-file-accesses'],
            headless: headless // Use the headless parameter
        });

        const page = await browser.newPage();
        
        page.on('console', msg => console.log('Browser console:', msg.text()));
        page.on('pageerror', err => console.error('Browser page error:', err));

        await page.setContent(html, { 
            waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
            timeout: 30000,
            baseURL: baseURL 
        });

        await page.evaluate(async () => {
            return new Promise((resolve) => {
                if (document.fonts && document.fonts.ready) {
                    document.fonts.ready.then(() => {
                        const backgroundUrl = getComputedStyle(document.body).backgroundImage;
                        if (backgroundUrl === 'none') {
                            resolve();
                            return;
                        }
                        
                        const img = new Image();
                        img.src = backgroundUrl.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
                        img.complete ? resolve() : img.onload = () => resolve();
                        img.onerror = () => {
                            console.error('Failed to load background image:', img.src);
                            resolve();
                        };
                    });
                } else {
                    resolve();
                }
            });
        });

        // Log relevant computed styles for debugging
        // await page.evaluate(() => {
        //     const elements = document.querySelectorAll('.repo-name, .description, .stats');
        //     elements.forEach(el => {
        //         const styles = getComputedStyle(el);
        //         console.log(`Computed styles for ${el.className}:`);
        //         console.log(`font-family: ${styles.getPropertyValue('font-family')}`);
        //         console.log(`font-size: ${styles.getPropertyValue('font-size')}`);
        //         console.log(`font-weight: ${styles.getPropertyValue('font-weight')}`);
        //         console.log(`font-feature-settings: ${styles.getPropertyValue('font-feature-settings')}`);
        //     });
        // });

        // Increase wait time to ensure font is loaded
        await new Promise(resolve => setTimeout(resolve, 3000));

        const buffer = await page.screenshot({ type: 'png' });

        if (!keepOpen) {
            await browser.close();
        }

        return buffer;
    }
}

module.exports = ImageGenerator;