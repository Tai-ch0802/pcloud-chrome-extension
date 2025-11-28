import { licenseManager } from '../../../core/license-manager.js';
import { getAuthToken } from '../../../core/auth.js';
import PCloudAPIClient from '../../../core/pcloud-api.js';

const PAYPAL_CLIENT_ID = 'ASIxhJYAlMUVAvBcQGtXSP5fsH9caU6n6zfWneS36yXTPIEajc99yzCwHA2VqbinPgikHvfJ0xLkv0Sv';

export default class PremiumSection {
    constructor() {
        this.element = null;
        this.premiumCard = null;
        this.premiumStatusBadge = null;
        this.promoContent = null;
        this.activeContent = null;
        this.restoreBtn = null;
        this.upgradePcloudBtn = null;
        this.upgradeMasterBtn = null;
        this.currentPlanNameEl = null;
        this.resultMessage = null;
        this.tierRadios = null;
        this.selectedTier = 'hf4pcloud'; // Default
        this.currentUserEmail = null;
    }

    async render() {
        const response = await fetch(chrome.runtime.getURL('src/options/sections/premium/template.html'));
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        this.element = doc.body.firstElementChild;
        return this.element;
    }

    async init() {
        this.premiumCard = this.element; // The root element is the card
        this.premiumStatusBadge = this.element.querySelector('#premium-status-badge');
        this.promoContent = this.element.querySelector('#premium-promo-content');
        this.activeContent = this.element.querySelector('#premium-active-content');
        this.restoreBtn = this.element.querySelector('#restore-purchase-btn');
        this.upgradePcloudBtn = this.element.querySelector('#upgrade-pcloud-btn');
        this.upgradeMasterBtn = this.element.querySelector('#upgrade-master-btn');
        this.currentPlanNameEl = this.element.querySelector('#current-plan-name');
        this.resultMessage = this.element.querySelector('#result-message');
        this.tierRadios = this.element.querySelectorAll('input[name="pricing-tier"]');

        await licenseManager.init();

        // Fetch user email for binding
        try {
            const authToken = await getAuthToken();
            if (authToken) {
                const client = new PCloudAPIClient(authToken);
                const userInfo = await client.getUserInfo();
                this.currentUserEmail = userInfo.email;
                console.log('User email fetched:', this.currentUserEmail);
            }
        } catch (e) {
            console.error('Failed to fetch user info:', e);
        }

        this.updateUI();

        licenseManager.addListener(() => this.updateUI());

        // Setup button listeners
        this.restoreBtn.addEventListener('click', () => this.restorePurchase());
        this.upgradePcloudBtn.addEventListener('click', () => this.openPaymentPage('hf4pcloud'));
        this.upgradeMasterBtn.addEventListener('click', () => this.openPaymentPage('hf4master'));

        // Listen for tier changes to show appropriate button
        this.tierRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.selectedTier = e.target.value;
                this.updateUpgradeButtons();
            });
        });

        this.updateUpgradeButtons();

        // Check for payment redirect parameters
        await this.checkPaymentRedirect();
    }

    showStatusMessage(messageKey) {
        window.dispatchEvent(new CustomEvent('options-saved', { detail: { messageKey } }));
    }

    async checkPaymentRedirect() {
        const urlParams = new URLSearchParams(window.location.search);
        const status = urlParams.get('status');
        const licenseKey = urlParams.get('license_key') || urlParams.get('license');

        if (status === 'success' && licenseKey) {
            console.log('[PremiumSection] Payment successful, checking license...');

            if (!this.currentUserEmail) {
                console.warn('[PremiumSection] No user email found during redirect handling.');
                this.showStatusMessage('options_error_loading_folders');
                return;
            }

            try {
                const license = await licenseManager.restorePurchase(this.currentUserEmail);

                if (license) {
                    this.showStatusMessage('options_payment_success');
                    const newUrl = window.location.pathname;
                    window.history.replaceState({}, document.title, newUrl);
                } else {
                    console.error('[PremiumSection] License verification failed after redirect.');
                    this.showStatusMessage('options_payment_failed');
                }
            } catch (error) {
                console.error('[PremiumSection] Failed to verify license:', error);
                this.showStatusMessage('options_payment_failed');
            }
        } else if (status === 'cancel') {
            this.showStatusMessage('options_payment_failed');
        }
    }

    updateUI() {
        const isPremium = licenseManager.isPremium();
        const license = licenseManager.getLicenseInfo();

        if (isPremium) {
            this.premiumCard.classList.add('active');
            this.premiumStatusBadge.classList.remove('hidden');
            this.promoContent.classList.add('hidden');
            this.activeContent.classList.remove('hidden');

            if (license) {
                const planNameKey = license.productType === 'hf4master' ? 'options_tier_master_name' : 'options_tier_pcloud_name';
                this.currentPlanNameEl.textContent = chrome.i18n.getMessage(planNameKey);
            }
        } else {
            this.premiumCard.classList.remove('active');
            this.premiumStatusBadge.classList.add('hidden');
            this.promoContent.classList.remove('hidden');
            this.activeContent.classList.add('hidden');
        }
    }

    updateUpgradeButtons() {
        if (this.selectedTier === 'hf4pcloud') {
            this.upgradePcloudBtn.style.display = 'inline-flex';
            this.upgradeMasterBtn.style.display = 'none';
        } else {
            this.upgradePcloudBtn.style.display = 'none';
            this.upgradeMasterBtn.style.display = 'inline-flex';
        }
    }

    openPaymentPage(tier) {
        if (!this.currentUserEmail) {
            this.showStatusMessage('options_error_loading_folders');
            console.error('[PremiumSection] No user email found');
            return;
        }

        const PAYMENT_URL = 'https://paypal-payment.taislife.work';
        const redirectUrl = chrome.runtime.getURL("src/options/options.html");

        console.log(`[PremiumSection] Opening payment page for ${tier}`);

        const paymentUrl = `${PAYMENT_URL}?tier=${tier}&email=${encodeURIComponent(this.currentUserEmail)}&client_id=${PAYPAL_CLIENT_ID}&redirect_url=${encodeURIComponent(redirectUrl)}`;

        chrome.tabs.create({
            url: paymentUrl
        }, (tab) => {
            console.log(`[PremiumSection] Opened tab ${tab.id}`);
            this.resultMessage.textContent = chrome.i18n.getMessage('options_payment_page_opening');
        });
    }

    async restorePurchase() {
        if (!this.currentUserEmail) {
            alert(chrome.i18n.getMessage('options_error_loading_folders'));
            return;
        }

        try {
            const license = await licenseManager.restorePurchase(this.currentUserEmail);
            if (license) {
                await licenseManager.saveLicense(license);
                this.showStatusMessage('options_restore_success');
            } else {
                this.showStatusMessage('options_restore_failed');
            }
        } catch (e) {
            console.error('Restore failed', e);
            this.showStatusMessage('options_restore_failed');
        }
    }
}
