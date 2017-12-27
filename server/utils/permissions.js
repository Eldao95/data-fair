// resource can be an application, a dataset of an external API
exports.can = function(resource, operationId, user) {
  if (!user) {
    const operationPermissions = (resource.permissions || []).filter(p => p.operationId === operationId)
    // check if the operation is public
    if (operationPermissions.find(p => !p.type && !p.id)) return true
    return false
  } else {
    // Check if the user is the owner of the API or in an organization that have the API
    if ((resource.owner.type === 'user' && resource.owner.id === user.id) || (resource.owner.type === 'organization' && user.organizations.find(o => o.id === resource.owner.id))) {
      return true
    } else {
      const operationPermissions = (resource.permissions || []).filter(p => p.operationId === operationId)
      if (operationPermissions.find(p => (p.type === 'user' && p.id === user.id) || (p.type === 'organization' && user.organizations.find(o => o.id === p.id)))) return true
      return false
    }
  }
}

// Manage filters for datasets, applications and external-apis
exports.filter = function(user) {
  // this filter is for public resources
  const or = [{
    'permissions.operationId': 'readDescription',
    'permissions.type': null,
    'permissions.id': null
  }]

  if (user) {
    const organizationIds = user.organizations.map(o => o.id)
    or.push({
      'owner.type': 'user',
      'owner.id': user.id
    })
    or.push({
      'owner.type': 'organization',
      'owner.id': {$in: organizationIds}
    })
    or.push({
      'permissions.operationId': 'readDescription',
      'permissions.type': 'user',
      'permissions.id': user.id
    })
    or.push({
      'permissions.operationId': 'readDescription',
      'permissions.type': 'organization',
      'permissions.id': {$in: organizationIds}
    })
  }
  return or
}
