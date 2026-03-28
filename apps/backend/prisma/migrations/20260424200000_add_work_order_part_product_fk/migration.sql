-- AddForeignKey
ALTER TABLE "work_order_parts" ADD CONSTRAINT "work_order_parts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
