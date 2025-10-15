// middleware/redirect.js
const handleRedirects = (req, res, next) => {
    // Add a redirect helper to the response object
    res.sendWithRedirect = function(status, data, redirectUrl) {
        // If it's an API request, send JSON response
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(status).json({
                ...data,
                redirect: redirectUrl
            });
        }
        
        // For regular requests, perform actual redirect
        return res.redirect(redirectUrl);
    };

    next();
};

module.exports = handleRedirects;