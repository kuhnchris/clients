import { mock, MockProxy } from "jest-mock-extended";

import { CollectionService } from "@bitwarden/common/admin-console/abstractions/collection.service";
import { CollectionView } from "@bitwarden/common/admin-console/models/view/collection.view";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { BitwardenPasswordProtectedImporter } from "../importers/bitwarden/bitwarden-password-protected-importer";
import { Importer } from "../importers/importer";
import { ImportResult } from "../models/import-result";

import { ImportApiServiceAbstraction } from "./import-api.service.abstraction";
import { ImportService } from "./import.service";

describe("ImportService", () => {
  let importService: ImportService;
  let cipherService: MockProxy<CipherService>;
  let folderService: MockProxy<FolderService>;
  let importApiService: MockProxy<ImportApiServiceAbstraction>;
  let i18nService: MockProxy<I18nService>;
  let collectionService: MockProxy<CollectionService>;
  let cryptoService: MockProxy<CryptoService>;

  beforeEach(() => {
    cipherService = mock<CipherService>();
    folderService = mock<FolderService>();
    importApiService = mock<ImportApiServiceAbstraction>();
    i18nService = mock<I18nService>();
    collectionService = mock<CollectionService>();
    cryptoService = mock<CryptoService>();

    importService = new ImportService(
      cipherService,
      folderService,
      importApiService,
      i18nService,
      collectionService,
      cryptoService
    );
  });

  describe("getImporterInstance", () => {
    describe("Get bitPasswordProtected importer", () => {
      let importer: Importer;
      const organizationId = Utils.newGuid();
      const password = Utils.newGuid();
      const promptForPassword_callback = async () => {
        return password;
      };

      beforeEach(() => {
        importer = importService.getImporter(
          "bitwardenpasswordprotected",
          promptForPassword_callback,
          organizationId
        );
      });

      it("returns an instance of BitwardenPasswordProtectedImporter", () => {
        expect(importer).toBeInstanceOf(BitwardenPasswordProtectedImporter);
      });

      it("has the promptForPassword_callback set", async () => {
        // Cast to any to access private property. Note: assumes instance of BitwardenPasswordProtectedImporter
        expect((importer as any).promptForPassword_callback).not.toBeNull();
        expect(await (importer as any).promptForPassword_callback()).toEqual(password);
      });

      it("has the appropriate organization Id", () => {
        expect(importer.organizationId).toEqual(organizationId);
      });
    });
  });

  describe("setImportTarget", () => {
    const organizationId = Utils.newGuid();

    let importResult: ImportResult;

    beforeEach(() => {
      importResult = new ImportResult();
    });

    it("empty import target does nothing", () => {
      importService["setImportTarget"](importResult, null, "");
      expect(importResult.folders.length).toBe(0);
    });

    it("passing importTarget adds it to folders", () => {
      importService["setImportTarget"](importResult, null, "myImportTarget");
      expect(importResult.folders.length).toBe(1);
      expect(importResult.folders[0].name).toBe("myImportTarget");
    });

    it("passing importTarget sets it as new root for all existing folders", () => {
      const myImportTarget = "myImportTarget";

      const folder1 = new FolderView();
      folder1.name = "folder1";
      importResult.folders.push(folder1);

      const folder2 = new FolderView();
      folder2.name = "folder2";
      importResult.folders.push(folder2);

      importService["setImportTarget"](importResult, null, myImportTarget);
      expect(importResult.folders.length).toBe(3);
      expect(importResult.folders[0].name).toBe(myImportTarget);
      expect(importResult.folders[1].name).toBe(`${myImportTarget}/${folder1.name}`);
      expect(importResult.folders[2].name).toBe(`${myImportTarget}/${folder2.name}`);
    });

    it("passing importTarget adds it to collections", () => {
      importService["setImportTarget"](importResult, organizationId, "myImportTarget");
      expect(importResult.collections.length).toBe(1);
      expect(importResult.collections[0].name).toBe("myImportTarget");
    });

    it("passing importTarget sets it as new root for all existing collections", () => {
      const myImportTarget = "myImportTarget";

      const collection1 = new CollectionView();
      collection1.name = "collection1";
      importResult.collections.push(collection1);

      const collection2 = new CollectionView();
      collection2.name = "collection2";
      importResult.collections.push(collection2);

      importService["setImportTarget"](importResult, organizationId, myImportTarget);
      expect(importResult.collections.length).toBe(3);
      expect(importResult.collections[0].name).toBe(myImportTarget);
      expect(importResult.collections[1].name).toBe(`${myImportTarget}/${collection1.name}`);
      expect(importResult.collections[2].name).toBe(`${myImportTarget}/${collection2.name}`);
    });
  });
});
