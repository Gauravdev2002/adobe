const canAccessDocument = (user, document) => {
    if (!user || !document) {
        return false;
    }

    if (user.role === "lawyer") {
        return (
            document.access.lawyers.some(id => id.toString() === user.id) ||
            document.uploadedBy.toString() === user.id
        );
    }

    if (user.role === "client") {
        return document.access.clients.some(id => id.toString() === user.id);
    }

    if (user.role === "government") {
        return document.access.government.some(id => id.toString() === user.id);
    }

    return false;
};

const canCommentOnDocument = (user, document) => {
    if (user.role === "lawyer") {
        return canAccessDocument(user, document);
    }

    if (user.role === "client") {
        return document.clientCommentingAllowed && canAccessDocument(user, document);
    }

    return false;
};

const canAccessCase = (user, caseFile) => {
    if (!user || !caseFile) {
        return false;
    }

    if (user.role === "lawyer") {
        return (
            caseFile.createdBy.toString() === user.id ||
            caseFile.members.lawyers.some(id => id.toString() === user.id)
        );
    }

    if (user.role === "client") {
        return caseFile.members.clients.some(id => id.toString() === user.id);
    }

    if (user.role === "government") {
        return caseFile.members.government.some(id => id.toString() === user.id);
    }

    return false;
};

module.exports = { canAccessDocument, canCommentOnDocument, canAccessCase };
