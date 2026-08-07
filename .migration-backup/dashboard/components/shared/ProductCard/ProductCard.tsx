"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import { ShoppingCart, Package } from "lucide-react";
import { useState } from "react";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    image_url?: string;
    stock_quantity: number;
    description?: string;
  };
  sellerPhone: string;
}

const ProductCard = ({ product, sellerPhone }: ProductCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const whatsappUrl = `https://wa.me/${sellerPhone}?text=${encodeURIComponent(
    `Bonjour ! Je suis intéressé par :\n\n📦 ${product.name}\n💰 Prix : ${product.price.toLocaleString()} FCFA\n\nPourriez-vous me donner plus d'infos ?`
  )}`;

  return (
    <motion.div
      className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <div className="relative h-40 sm:h-48 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className={`object-cover transition-transform duration-500 ${
              isHovered ? "scale-110" : "scale-100"
            }`}
            sizes="(max-width: 768px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-16 h-16 text-gray-300" />
          </div>
        )}
        
        {/* Badge stock */}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
            product.stock_quantity > 0 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            {product.stock_quantity > 0 ? 'En stock' : 'Rupture'}
          </span>
        </div>

        {/* Overlay au hover */}
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-gray-900 px-4 py-2 rounded-full font-semibold text-sm flex items-center gap-2 hover:scale-105 transition-transform"
          >
            <ShoppingCart size={16} />
            Commander
          </a>
        </div>
      </div>

      {/* Info produit */}
      <div className="p-3 sm:p-4">
        <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate mb-1">
          {product.name}
        </h3>
        
        {product.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">
            {product.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-2">
          <span className="text-lg font-black bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            {product.price.toLocaleString()} FCFA
          </span>
          <span className="text-xs text-gray-400">
            Stock: {product.stock_quantity}
          </span>
        </div>

        {/* Bouton mobile */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 w-full sm:hidden flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg transition-all"
        >
          <ShoppingCart size={16} />
          Commander sur WhatsApp
        </a>
      </div>
    </motion.div>
  );
};

export default ProductCard;
