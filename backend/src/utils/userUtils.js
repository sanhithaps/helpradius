/**
 * User data transformation utilities for privacy and security.
 */

function toPublicUser(user) {
  if (!user) return null;

  // Mask ID number so only the last 4 characters are exposed
  let idLast4 = user.idLast4;
  if (!idLast4) {
    if (user.verificationId) {
      const clean = String(user.verificationId).replace(/[^a-zA-Z0-9]/g, '');
      const last4 = clean.length >= 4 ? clean.slice(-4) : clean.padStart(4, 'X');
      idLast4 = `XXXX-XXXX-${last4}`;
    } else {
      idLast4 = 'XXXX-XXXX-0000';
    }
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role || 'user',
    isHelper: Boolean(user.isHelper),
    idType: user.idType || 'Government / National ID',
    idLast4,
    idVerified: Boolean(user.idVerified),
    address: user.address || 'Current Location',
    avatar: user.avatar,
    emergencyContacts: user.emergencyContacts || [],
    permissions: user.permissions || { locationGranted: true, notificationsGranted: true },
    suspended: Boolean(user.suspended || user.isSuspended),
    createdAt: user.createdAt
  };
}

module.exports = {
  toPublicUser
};
