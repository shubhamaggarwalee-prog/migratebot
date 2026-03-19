/**
 * backend/middleware/validate.js
 * Request body validation middleware
 */
module.exports = function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, rules] of Object.entries(schema)) {
      const val = req.body[field];
      if (rules.required && (val === undefined || val === null || val === '')) {
        errors.push(`${field} is required`);
      }
      if (val !== undefined) {
        if (rules.type && typeof val !== rules.type) errors.push(`${field} must be a ${rules.type}`);
        if (rules.minLength && val.length < rules.minLength) errors.push(`${field} must be at least ${rules.minLength} characters`);
        if (rules.maxLength && val.length > rules.maxLength) errors.push(`${field} must be at most ${rules.maxLength} characters`);
        if (rules.enum && !rules.enum.includes(val)) errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
        if (rules.pattern && !rules.pattern.test(val)) errors.push(`${field} format is invalid`);
      }
    }
    if (errors.length > 0) return res.status(400).json({ error: errors.join('; ') });
    next();
  };
};
