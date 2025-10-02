/**
 * Client-side validation utilities for BLFS forms
 * Used in dev portal for shop creation and editing
 */

// Validation functions
const validators = {
  // Merchant username: no spaces, max 20 chars, alphanumeric + underscore/hyphen
  merchantUsername: (value) => {
    if (!value || value.trim() === '') {
      return { valid: false, error: 'Username is required' };
    }
    if (value.length > 20) {
      return { valid: false, error: 'Username must be 20 characters or less' };
    }
    if (/\s/.test(value)) {
      return { valid: false, error: 'Username cannot contain spaces' };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      return { valid: false, error: 'Username can only contain letters, numbers, hyphens, and underscores' };
    }
    return { valid: true };
  },

  // Shopify domain: must be a valid .myshopify.com domain (FQDN), no protocol, no trailing slash
  shopifyDomain: (value) => {
    if (!value || value.trim() === '') {
      return { valid: false, error: 'Shopify domain is required' };
    }
    
    // Remove any protocol if user added it
    let cleaned = value.trim().toLowerCase();
    if (cleaned.startsWith('https://') || cleaned.startsWith('http://')) {
      return { valid: false, error: 'Remove https:// or http:// from domain' };
    }
    
    // Remove trailing slash if present
    if (cleaned.endsWith('/')) {
      return { valid: false, error: 'Remove trailing / from domain' };
    }
    
    // Must end with .myshopify.com (strict FQDN requirement)
    if (!cleaned.endsWith('.myshopify.com')) {
      return { valid: false, error: 'Domain must end with .myshopify.com (e.g., anna-jaques.myshopify.com)' };
    }
    
    // Basic format check: subdomain.myshopify.com (exactly 3 parts)
    const parts = cleaned.split('.');
    if (parts.length !== 3 || parts[0] === '') {
      return { valid: false, error: 'Invalid format. Use: your-shop.myshopify.com' };
    }
    
    // Validate subdomain (slug) contains only valid characters
    const slug = parts[0];
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return { valid: false, error: 'Shop name can only contain lowercase letters, numbers, and hyphens' };
    }
    
    // Slug cannot start or end with hyphen
    if (slug.startsWith('-') || slug.endsWith('-')) {
      return { valid: false, error: 'Shop name cannot start or end with a hyphen' };
    }
    
    return { valid: true, cleaned };
  },

  // NWC URI: must start with nostr+walletconnect://, must have relay parameter
  nwcUri: (value, required = true) => {
    if (!value || value.trim() === '') {
      if (required) {
        return { valid: false, error: 'NWC URI is required' };
      }
      return { valid: true }; // Optional field, empty is OK
    }
    
    const cleaned = value.trim();
    
    if (!cleaned.startsWith('nostr+walletconnect://')) {
      return { valid: false, error: 'NWC URI must start with nostr+walletconnect://' };
    }
    
    // Check for relay parameter
    try {
      const url = new URL(cleaned);
      const relay = url.searchParams.get('relay');
      if (!relay || relay.trim() === '') {
        return { valid: false, error: 'NWC URI must include a relay parameter' };
      }
    } catch (e) {
      return { valid: false, error: 'Invalid NWC URI format' };
    }
    
    return { valid: true };
  },

  // Logo URL: must be a valid URL ending with image extension
  logoUrl: (value) => {
    if (!value || value.trim() === '') {
      return { valid: true }; // Optional field
    }
    
    const cleaned = value.trim();
    
    // Must be a valid URL
    try {
      const url = new URL(cleaned);
      if (!url.protocol.match(/^https?:$/)) {
        return { valid: false, error: 'Logo URL must use http:// or https://' };
      }
    } catch (e) {
      return { valid: false, error: 'Invalid URL format' };
    }
    
    // Must end with common image extension
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
    const hasImageExt = imageExtensions.some(ext => 
      cleaned.toLowerCase().endsWith(ext)
    );
    
    if (!hasImageExt) {
      return { valid: false, error: 'Logo URL must end with .png, .jpg, .jpeg, .webp, .gif, or .svg' };
    }
    
    return { valid: true };
  }
};

// Form validation helper
function validateField(input, validatorName, required = true) {
  const result = validators[validatorName](input.value, required);
  const feedbackEl = input.nextElementSibling;
  
  if (!result.valid) {
    input.classList.add('is-invalid');
    input.classList.remove('is-valid');
    if (feedbackEl && feedbackEl.classList.contains('invalid-feedback')) {
      feedbackEl.textContent = result.error;
    }
    return false;
  } else {
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    // Auto-clean domain if needed
    if (result.cleaned && result.cleaned !== input.value) {
      input.value = result.cleaned;
    }
    return true;
  }
}

// Validate entire form
function validateForm(formId, validations) {
  const form = document.getElementById(formId);
  if (!form) return false;
  
  let allValid = true;
  
  Object.entries(validations).forEach(([fieldName, validatorName]) => {
    const input = form.querySelector(`[name="${fieldName}"]`);
    if (input) {
      const required = input.hasAttribute('required');
      const isValid = validateField(input, validatorName, required);
      if (!isValid) allValid = false;
    }
  });
  
  return allValid;
}

// Check if all required fields have values
function checkRequiredFields(formId, requiredFields) {
  const form = document.getElementById(formId);
  if (!form) return false;
  
  for (const fieldName of requiredFields) {
    const input = form.querySelector(`[name="${fieldName}"]`);
    if (!input || !input.value || input.value.trim() === '') {
      return false;
    }
  }
  return true;
}

// Enable/disable submit button based on form state
function updateSubmitButton(formId, submitBtnId, requiredFields, validations) {
  const submitBtn = document.getElementById(submitBtnId);
  if (!submitBtn) return;
  
  // Check if all required fields have values
  const hasAllRequired = checkRequiredFields(formId, requiredFields);
  
  // Check if any field has validation errors
  const form = document.getElementById(formId);
  const hasErrors = form.querySelector('.is-invalid') !== null;
  
  // Enable button only if all required fields are filled and no validation errors
  submitBtn.disabled = !hasAllRequired || hasErrors;
}

// Setup real-time validation for a form
function setupFormValidation(formId, validations, submitBtnId, requiredFields = null) {
  const form = document.getElementById(formId);
  const submitBtn = document.getElementById(submitBtnId);
  
  if (!form) return;
  
  // Add invalid-feedback divs if they don't exist
  Object.keys(validations).forEach(fieldName => {
    const input = form.querySelector(`[name="${fieldName}"]`);
    if (input && !input.nextElementSibling?.classList.contains('invalid-feedback')) {
      const feedback = document.createElement('div');
      feedback.className = 'invalid-feedback';
      input.parentNode.insertBefore(feedback, input.nextSibling);
    }
  });
  
  // If requiredFields provided, disable button until all required fields are filled
  if (requiredFields && submitBtn) {
    submitBtn.disabled = true;
    
    // Update button state on any input change
    const updateButton = () => {
      updateSubmitButton(formId, submitBtnId, requiredFields, validations);
    };
    
    // Listen to all form inputs
    form.querySelectorAll('input, select, textarea').forEach(input => {
      input.addEventListener('input', updateButton);
      input.addEventListener('blur', updateButton);
    });
    
    // Initial check
    updateButton();
  }
  
  // Validate on blur and input
  Object.entries(validations).forEach(([fieldName, validatorName]) => {
    const input = form.querySelector(`[name="${fieldName}"]`);
    if (input) {
      input.addEventListener('blur', () => {
        const required = input.hasAttribute('required');
        validateField(input, validatorName, required);
        if (requiredFields && submitBtn) {
          updateSubmitButton(formId, submitBtnId, requiredFields, validations);
        }
      });
      
      input.addEventListener('input', () => {
        // Clear validation state on input
        input.classList.remove('is-invalid', 'is-valid');
      });
    }
  });
  
  // Validate on submit
  form.addEventListener('submit', (e) => {
    const isValid = validateForm(formId, validations);
    if (!isValid) {
      e.preventDefault();
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    }
  });
}
