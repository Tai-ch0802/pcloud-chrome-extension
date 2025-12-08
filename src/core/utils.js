/**
 * Matches a URL against a list of domain/path rules.
 * @param {string} url - The URL to test.
 * @param {Array} rules - The list of rule objects { title, domainPattern, enabled, targetPath }.
 * @returns {object|null} - The matched rule object or null.
 */
export function matchDomainRule(url, rules) {
    if (!url || !rules || rules.length === 0) return null;

    let urlObj;
    try {
        urlObj = new URL(url);
    } catch (e) {
        // If input is not a full URL (e.g. just domain), continue
    }

    const hostname = urlObj ? urlObj.hostname : url;
    const fullUrlNoProtocol = url.replace(/^https?:\/\//, '');

    return rules.find(rule => {
        if (!rule.enabled) return false;

        const pattern = rule.domainPattern;
        // Escape dots, replace * with .*
        // We only replace * if it looks like a glob. If user wrote regex, it might break, 
        // but the UI implies simple glob (domain/path).
        const regexStr = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';

        try {
            const regex = new RegExp(regexStr);

            // Heuristic: If pattern contains '/', it's a path match -> check against full URL (no protocol)
            // If pattern has no '/', it's a domain match -> check against hostname
            if (pattern.includes('/')) {
                // Check if full URL (no protocol) matches
                // Also check if using full url with protocol matches? 
                // Usually users omit protocol in rules like "example.com/foo/*"
                if (regex.test(fullUrlNoProtocol)) return true;
                // Maybe they included protocol? "https://example.com/*"
                // But pattern likely won't have the protocol part based on my regex construction if they didn't escape it.
                // Generally we assume pattern is "host/path".
            } else {
                if (regex.test(hostname)) return true;
            }
            return false;
        } catch (e) {
            console.warn('Invalid regex in domain rule:', pattern, e);
            return false;
        }
    });
}
