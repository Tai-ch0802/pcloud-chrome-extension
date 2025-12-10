// src/core/license-manager.js

const LICENSE_STORAGE_KEY = 'hypercmdc_license';

export class LicenseManager {
    constructor() {
        this.license = null;
        this.listeners = [];
    }

    async init() {
        const { [LICENSE_STORAGE_KEY]: savedLicense } = await chrome.storage.sync.get(LICENSE_STORAGE_KEY);
        this.license = savedLicense || null;
    }

    isPremium() {
        if (!this.license) return false;
        return this.license.status === 'premium' || this.license.status === 'master';
    }

    getLicenseInfo() {
        return this.license;
    }

    async saveLicense(licenseData) {
        this.license = licenseData;
        await chrome.storage.sync.set({ [LICENSE_STORAGE_KEY]: licenseData });
        this.notifyListeners();
    }

    async clearLicense() {
        this.license = null;
        await chrome.storage.sync.remove(LICENSE_STORAGE_KEY);
        this.notifyListeners();
    }

    addListener(callback) {
        this.listeners.push(callback);
    }

    removeListener(callback) {
        this.listeners = this.listeners.filter(cb => cb !== callback);
    }

    notifyListeners() {
        this.listeners.forEach(cb => cb(this.isPremium()));
    }

    /**
     * Verifies the PayPal order and generates a license.
     * @param {string} orderID - The PayPal Order ID.
     * @param {string} email - The user's pCloud email.
     * @param {string} productType - 'hf4pcloud' or 'hf4master'.
     * @returns {Promise<Object>} The generated license data.
     */
    async verifyPayPalOrder(orderID, email, productType) {
        console.log(`[LicenseManager] Verifying Order: ${orderID} for ${email} (${productType})`);

        // Simulate API latency
        await new Promise(resolve => setTimeout(resolve, 1000));

        const status = productType === 'hf4master' ? 'master' : 'premium';
        const licenseKey = `hf_v1_${btoa(`${email}|${productType}|${Date.now()}`).substring(0, 20)}`;

        const licenseData = {
            status: status,
            productType: productType,
            key: licenseKey,
            purchaseDate: new Date().toISOString(),
            orderID: orderID,
            email: email
        };

        // MOCK BACKEND: Save to local storage to simulate server DB for restore
        const { mock_backend_db = {} } = await chrome.storage.local.get('mock_backend_db');

        // Logic: Master overrides Premium. Premium only overrides if no Master.
        const existing = mock_backend_db[email];
        if (!existing || existing.status !== 'master') {
            mock_backend_db[email] = licenseData;
            await chrome.storage.local.set({ mock_backend_db });
        } else if (status === 'master') {
            // Upgrade to master
            mock_backend_db[email] = licenseData;
            await chrome.storage.local.set({ mock_backend_db });
        }

        return licenseData;
    }

    /**
     * Restores purchase based on email.
     * @param {string} email 
     * @returns {Promise<Object|null>}
     */
    async restorePurchase(email) {
        console.log(`[LicenseManager] Restoring purchase for ${email}`);

        try {
            const response = await fetch('https://hyper-cmdc-license-api.taislife.work/api/restore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            if (!response.ok) {
                console.error('[LicenseManager] Restore API failed:', response.status, response.statusText);
                return null;
            }

            const data = await response.json();

            if (data.success && data.license) {
                console.log('[LicenseManager] License restored successfully:', data.license);

                // Map API response to internal license format if necessary, 
                // but it seems the API returns the correct structure based on the comment.
                // Ensuring consistent property naming (camelCase vs snake_case from comment example vs internal use)
                // The comment example used mixed casing: productType vs product_type. 
                // Let's assume the API returns what we need or map it.
                // Internal structure uses: status, productType, key, email, orderID, purchaseDate
                // API example: status, product_type, license_key, email, order_id, created_at

                const license = {
                    status: data.license.status,
                    productType: data.license.productType || data.license.product_type,
                    key: data.license.key || data.license.license_key,
                    email: data.license.email,
                    orderID: data.license.orderID || data.license.order_id,
                    purchaseDate: data.license.purchaseDate || data.license.created_at || data.license.purchase_date
                };

                await this.saveLicense(license);
                return license;
            } else {
                console.log('[LicenseManager] No license found in response:', data);
                return null;
            }
        } catch (error) {
            console.error('[LicenseManager] Error restoring purchase:', error);
            return null;
        }
    }
}

export const licenseManager = new LicenseManager();
