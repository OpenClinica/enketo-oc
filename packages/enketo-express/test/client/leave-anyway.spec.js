import {
    isLeaveAnyway,
    LEAVE_ANYWAY,
} from '../../public/js/src/module/controller-webform-oc';

describe('Leave anyway decision', () => {
    it('leaves only for the "Leave anyway" button', () => {
        expect(isLeaveAnyway(LEAVE_ANYWAY)).to.equal(true);
    });

    it('stays for Stay (true) and for Escape, close and overlay (false or undefined)', () => {
        expect(isLeaveAnyway(true)).to.equal(false);
        expect(isLeaveAnyway(false)).to.equal(false);
        expect(isLeaveAnyway(undefined)).to.equal(false);
    });
});
